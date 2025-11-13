import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Lock, Save, X, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import PriceBookDialog from "@/components/quotes/PriceBookDialog";
import { Label } from "@/components/ui/label";

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

  const addLineItem = (parentId?: string) => {
    const newItem: LineItem = {
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
      parent_line_item_id: parentId,
      item_order: editingItems.length,
    };
    setEditingItems([...editingItems, newItem]);
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
          id: undefined,
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

  const topLevelItems = displayItems.filter(item => !item.parent_line_item_id);
  const getSubItems = (parentId?: string) => {
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
                  {isEditing ? "Editing line items (locked items from quotes cannot be modified)" : "Items marked with a lock are from the original quote"}
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
                <Button onClick={() => addLineItem()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>

                {topLevelItems.map((item, parentIndex) => {
                  const subItems = getSubItems(item.id);
                  const actualIndex = displayItems.indexOf(item);
                  
                  return (
                    <div key={actualIndex} className="border rounded-lg overflow-hidden">
                      {/* Parent Item */}
                      <div className="bg-muted/20 p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          {item.is_locked && (
                            <Lock className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 space-y-3">
                            <div className="grid gap-3 md:grid-cols-6">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Description</Label>
                                <div className="flex gap-2">
                                  <Input
                                    value={item.description}
                                    onChange={(e) => updateLineItem(actualIndex, "description", e.target.value)}
                                    disabled={item.is_locked}
                                    className="font-medium"
                                  />
                                  {!item.is_locked && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setCurrentLineIndex(actualIndex);
                                        setShowPriceBook(true);
                                      }}
                                    >
                                      <Package className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Qty</Label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateLineItem(actualIndex, "quantity", parseFloat(e.target.value) || 0)}
                                  disabled={item.is_locked}
                                />
                              </div>
                              {subItems.length === 0 && (
                                <>
                                  <div>
                                    <Label className="text-xs">Unit Price</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_price}
                                      onChange={(e) => updateLineItem(actualIndex, "unit_price", parseFloat(e.target.value) || 0)}
                                      disabled={item.is_locked}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Cost</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.cost_price}
                                      onChange={(e) => updateLineItem(actualIndex, "cost_price", parseFloat(e.target.value) || 0)}
                                      disabled={item.is_locked}
                                    />
                                  </div>
                                </>
                              )}
                              <div>
                                <Label className="text-xs">Total</Label>
                                <Input
                                  type="number"
                                  value={formatCurrency(item.line_total)}
                                  disabled
                                  className="font-semibold"
                                />
                              </div>
                            </div>
                            
                            {!item.is_locked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addLineItem(item.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Sub-item
                              </Button>
                            )}
                          </div>
                          
                          {!item.is_locked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(actualIndex)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Sub Items */}
                      {subItems.map((subItem) => {
                        const subIndex = displayItems.indexOf(subItem);
                        return (
                          <div key={subIndex} className="border-t bg-background/50 p-4 pl-12 space-y-3">
                            <div className="flex items-start gap-2">
                              {subItem.is_locked && (
                                <Lock className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
                              )}
                              <div className="flex-1 grid gap-3 md:grid-cols-6">
                                <div className="md:col-span-2">
                                  <Label className="text-xs">Description</Label>
                                  <Input
                                    value={subItem.description}
                                    onChange={(e) => updateLineItem(subIndex, "description", e.target.value)}
                                    disabled={subItem.is_locked}
                                    className="text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Qty</Label>
                                  <Input
                                    type="number"
                                    value={subItem.quantity}
                                    onChange={(e) => updateLineItem(subIndex, "quantity", parseFloat(e.target.value) || 0)}
                                    disabled={subItem.is_locked}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Unit Price</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={subItem.unit_price}
                                    onChange={(e) => updateLineItem(subIndex, "unit_price", parseFloat(e.target.value) || 0)}
                                    disabled={subItem.is_locked}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Cost</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={subItem.cost_price}
                                    onChange={(e) => updateLineItem(subIndex, "cost_price", parseFloat(e.target.value) || 0)}
                                    disabled={subItem.is_locked}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Total</Label>
                                    <Input
                                      type="number"
                                      value={formatCurrency(subItem.line_total)}
                                    disabled
                                    className="font-medium"
                                  />
                                </div>
                              </div>
                              
                              {!subItem.is_locked && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeLineItem(subIndex)}
                                  className="mt-5"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {topLevelItems.map((item) => {
                  const subItems = getSubItems(item.id);
                  const hasSubItems = subItems.length > 0;
                  
                  return (
                    <div key={item.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-start justify-between p-3 bg-muted/20">
                        <div className="flex-1 flex items-start gap-2">
                          {item.is_locked && <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.description}</p>
                              {item.from_quote && <Badge variant="secondary">From Quote</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Qty: {item.quantity}
                              {!hasSubItems && (
                                <>
                                  {" • "}Cost: {formatCurrency(item.cost_price)}
                                  {" • "}Margin: {item.margin_percentage.toFixed(2)}%
                                  {" • "}Sell: {formatCurrency(item.sell_price || item.unit_price)}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-medium">
                          {formatCurrency(item.line_total)}
                        </div>
                      </div>
                      
                      {hasSubItems && (
                        <div className="border-t">
                          {subItems.map((subItem) => (
                            <div key={subItem.id} className="flex items-start justify-between p-3 pl-8 border-b last:border-b-0 bg-background/50">
                              <div className="flex-1 flex items-start gap-2">
                                {subItem.is_locked && <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                                <div className="flex-1">
                                  <p className="text-sm">{subItem.description}</p>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Qty: {subItem.quantity}
                                    {" • "}Cost: {formatCurrency(subItem.cost_price)}
                                    {" • "}Margin: {subItem.margin_percentage.toFixed(2)}%
                                    {" • "}Sell: {formatCurrency(subItem.sell_price || subItem.unit_price)}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-sm font-medium">
                                {formatCurrency(subItem.line_total)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!isEditing && (
              <div className="bg-muted p-4 rounded-lg space-y-2 mt-6">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-medium">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Margin:</span>
                  <span>{formatCurrency(totalMargin)}</span>
                </div>
              </div>
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
