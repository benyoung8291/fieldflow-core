import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Lock, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PriceBookDialog from "@/components/quotes/PriceBookDialog";

interface ProjectFinanceTabProps {
  projectId: string;
}

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  sell_price: number;
  margin_percentage: number;
  line_total: number;
  notes?: string;
  price_book_item_id?: string;
  is_from_price_book: boolean;
  from_quote: boolean;
  is_locked: boolean;
  parent_line_item_id?: string;
  item_order: number;
}

export default function ProjectFinanceTab({ projectId }: ProjectFinanceTabProps) {
  const { toast } = useToast();
  const [editingItems, setEditingItems] = useState<LineItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showPriceBook, setShowPriceBook] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<string>("");

  const { data: lineItems, isLoading, refetch } = useQuery({
    queryKey: ["project-line-items", projectId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (profile) setTenantId(profile.tenant_id);
      }

      const { data, error } = await supabase
        .from("project_line_items" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("item_order", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const topLevelItems = (lineItems as any)?.filter((item: any) => !item.parent_line_item_id) || [];
  
  const getChildItems = (parentId: string) => {
    return (lineItems as any)?.filter((item: any) => item.parent_line_item_id === parentId) || [];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  const handleEdit = () => {
    const itemsWithFlags = (lineItems as any)?.map((item: any) => ({
      ...item,
      from_quote: item.from_quote ?? false,
      is_locked: item.is_locked ?? false,
    })) || [];
    setEditingItems(itemsWithFlags);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingItems([]);
    setIsEditing(false);
  };

  const addLineItem = () => {
    setEditingItems([
      ...editingItems,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        cost_price: 0,
        sell_price: 0,
        margin_percentage: 0,
        line_total: 0,
        is_from_price_book: false,
        from_quote: false,
        is_locked: false,
        item_order: editingItems.length,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setEditingItems(editingItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...editingItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (["quantity", "unit_price"].includes(field)) {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }
    
    if (["cost_price", "sell_price", "unit_price"].includes(field)) {
      const sellPrice = updated[index].sell_price || updated[index].unit_price;
      const costPrice = updated[index].cost_price;
      if (sellPrice > 0) {
        updated[index].margin_percentage = ((sellPrice - costPrice) / sellPrice) * 100;
      }
    }
    
    setEditingItems(updated);
  };

  const handlePriceBookSelect = (item: any) => {
    if (currentLineIndex !== null) {
      const updated = [...editingItems];
      updated[currentLineIndex] = {
        ...updated[currentLineIndex],
        description: item.description,
        unit_price: item.sell_price,
        cost_price: item.cost_price,
        sell_price: item.sell_price,
        margin_percentage: item.margin_percentage,
        line_total: updated[currentLineIndex].quantity * item.sell_price,
        price_book_item_id: item.id,
        is_from_price_book: true,
      };
      setEditingItems(updated);
    }
    setShowPriceBook(false);
  };

  const handleSave = async () => {
    try {
      // Delete existing non-locked items
      const { data: existing } = await supabase
        .from("project_line_items" as any)
        .select("id")
        .eq("project_id", projectId)
        .eq("is_locked", false);

      if (existing && existing.length > 0) {
        await supabase
          .from("project_line_items" as any)
          .delete()
          .in("id", existing.map((item: any) => item.id));
      }

      // Insert updated items (excluding locked items from edit)
      const itemsToInsert: any[] = editingItems
        .filter(item => !item.is_locked)
        .map((item, index) => ({
          ...item,
          project_id: projectId,
          tenant_id: tenantId,
          item_order: index,
          id: undefined, // Let DB generate new IDs
        }));

      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from("project_line_items" as any)
          .insert(itemsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Line items updated successfully",
      });

      await refetch();
      setIsEditing(false);
      setEditingItems([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading finance data...</p>
        </CardContent>
      </Card>
    );
  }

  const displayItems = isEditing ? editingItems : ((lineItems as any)?.map((item: any) => ({
    ...item,
    from_quote: item.from_quote ?? false,
    is_locked: item.is_locked ?? false,
  })) || []);
  const totalCost = displayItems.reduce((sum, item) => sum + (Number(item.cost_price) * Number(item.quantity)), 0);
  const totalRevenue = displayItems.reduce((sum, item) => sum + Number(item.line_total), 0);
  const totalMargin = totalRevenue - totalCost;
  const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  const topLevel = displayItems.filter(item => !item.parent_line_item_id);
  const getChildren = (parentId?: string) => {
    return displayItems.filter(item => item.parent_line_item_id === parentId);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalMargin)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Margin %</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{marginPercentage.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Project Budget Line Items</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {isEditing ? "Editing line items (locked items from quotes cannot be modified)" : "Items marked with a lock are from the original quote and cannot be edited"}
                </p>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={handleEdit}>Edit Line Items</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <Button onClick={addLineItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>

                {displayItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      {item.is_locked && (
                        <Lock className="h-5 w-5 text-muted-foreground mt-6" />
                      )}
                      <div className="flex-1 grid gap-3 md:grid-cols-6">
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">Description</label>
                          <div className="flex gap-2">
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              disabled={item.is_locked}
                            />
                            {!item.is_locked && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentLineIndex(index);
                                  setShowPriceBook(true);
                                }}
                              >
                                Pricebook
                              </Button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Qty</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            disabled={item.is_locked}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Unit Price</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                            disabled={item.is_locked}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Cost</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.cost_price}
                            onChange={(e) => updateLineItem(index, "cost_price", parseFloat(e.target.value) || 0)}
                            disabled={item.is_locked}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Total</label>
                          <Input
                            type="number"
                            value={item.line_total.toFixed(2)}
                            disabled
                          />
                        </div>
                      </div>
                      {!item.is_locked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          className="mt-6"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLevel.map((item) => {
                    const children = getChildren(item.id);
                    return (
                      <>
                        <TableRow key={item.id} className="font-medium">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                              {item.description}
                              {item.from_quote && <Badge variant="secondary" className="ml-2">From Quote</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.cost_price))}</TableCell>
                          <TableCell className="text-right">{item.margin_percentage}%</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(Number(item.line_total))}</TableCell>
                        </TableRow>
                        {children.map((child) => (
                          <TableRow key={child.id} className="text-sm">
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2">
                                {child.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                                {child.description}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{child.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(child.unit_price))}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(child.cost_price))}</TableCell>
                            <TableCell className="text-right">{child.margin_percentage}%</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(child.line_total))}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <PriceBookDialog
        open={showPriceBook}
        onOpenChange={setShowPriceBook}
        onSelectItem={handlePriceBookSelect}
        allowAssemblies={false}
      />
    </>
  );
}
