import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Search, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssemblyDialog from "./AssemblyDialog";
import { formatCurrency } from "@/lib/utils";

interface PriceBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectItem?: (item: any) => void;
  onSelectAssembly?: (assembly: any) => void;
  allowAssemblies?: boolean;
}

export default function PriceBookDialog({ open, onOpenChange, onSelectItem, onSelectAssembly, allowAssemblies = true }: PriceBookDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [assemblyDialogOpen, setAssemblyDialogOpen] = useState(false);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | undefined>();

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    unit: "each",
    cost_price: "0",
    margin_percentage: "30",
    sell_price: "0",
    category: "",
    notes: "",
  });

  const { data: items } = useQuery({
    queryKey: ["price-book-items", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("price_book_items")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: assemblies } = useQuery({
    queryKey: ["price-book-assemblies", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("price_book_assemblies")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setShowForm(false);
      setEditingItem(null);
      setAssemblyDialogOpen(false);
      setSelectedAssemblyId(undefined);
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      unit: "each",
      cost_price: "0",
      margin_percentage: "30",
      sell_price: "0",
      category: "",
      notes: "",
    });
  };

  const calculatePricing = (field: string, value: string) => {
    const cost = field === "cost_price" ? parseFloat(value) : parseFloat(formData.cost_price);
    const margin = field === "margin_percentage" ? parseFloat(value) : parseFloat(formData.margin_percentage);
    const sell = field === "sell_price" ? parseFloat(value) : parseFloat(formData.sell_price);

    let newData = { ...formData, [field]: value };

    if (field === "cost_price" || field === "margin_percentage") {
      // Calculate sell price from cost and margin
      const calculatedSell = cost * (1 + margin / 100);
      newData.sell_price = formatCurrency(calculatedSell);
    } else if (field === "sell_price") {
      // Calculate margin from cost and sell
      if (cost > 0) {
        const calculatedMargin = ((sell - cost) / cost) * 100;
        newData.margin_percentage = calculatedMargin.toFixed(2);
      }
    }

    setFormData(newData);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      description: item.description,
      unit: item.unit || "each",
      cost_price: item.cost_price.toString(),
      margin_percentage: item.margin_percentage.toString(),
      sell_price: item.sell_price.toString(),
      category: item.category || "",
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const itemData = {
        tenant_id: profile?.tenant_id,
        code: formData.code,
        description: formData.description,
        unit: formData.unit,
        cost_price: parseFloat(formData.cost_price),
        margin_percentage: parseFloat(formData.margin_percentage),
        sell_price: parseFloat(formData.sell_price),
        category: formData.category || null,
        notes: formData.notes || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("price_book_items")
          .update(itemData)
          .eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Item updated successfully" });
      } else {
        const { error } = await supabase
          .from("price_book_items")
          .insert([itemData]);
        if (error) throw error;
        toast({ title: "Item created successfully" });
      }

      queryClient.invalidateQueries({ queryKey: ["price-book-items"] });
      setShowForm(false);
      setEditingItem(null);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error saving item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase
        .from("price_book_items")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Item deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["price-book-items"] });
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAssembly = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assembly?")) return;

    try {
      const { error } = await supabase
        .from("price_book_assemblies")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Assembly deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["price-book-assemblies"] });
    } catch (error: any) {
      toast({
        title: "Error deleting assembly",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSelectAssembly = async (assembly: any) => {
    if (!onSelectAssembly) return;

    // Fetch assembly items
    const { data: items } = await supabase
      .from("price_book_assembly_items")
      .select("*")
      .eq("assembly_id", assembly.id)
      .order("item_order");

    onSelectAssembly({ ...assembly, items });
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Price Book</DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <Tabs defaultValue="items" className="w-full">
            {allowAssemblies && (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="assemblies">Assemblies</TabsTrigger>
              </TabsList>
            )}
            {!allowAssemblies && (
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="items">Items</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="items" className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                      <TableHead className="text-right">Sell</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item) => (
                      <TableRow key={item.id} className={onSelectItem ? "cursor-pointer hover:bg-muted/50" : ""}>
                        <TableCell className="font-mono">{item.code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cost_price)}</TableCell>
                        <TableCell className="text-right">{item.margin_percentage.toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.sell_price)}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {onSelectItem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                onSelectItem(item);
                                onOpenChange(false);
                              }}
                            >
                              Select
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!items || items.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No items found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {allowAssemblies && (
              <TabsContent value="assemblies" className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assemblies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={() => {
                  setSelectedAssemblyId(undefined);
                  setAssemblyDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Assembly
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assemblies?.map((assembly) => (
                      <TableRow key={assembly.id} className={onSelectAssembly ? "cursor-pointer hover:bg-muted/50" : ""}>
                        <TableCell className="font-mono">{assembly.code}</TableCell>
                        <TableCell className="font-medium">{assembly.name}</TableCell>
                        <TableCell>{assembly.description}</TableCell>
                        <TableCell>{assembly.category}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {onSelectAssembly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSelectAssembly(assembly)}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Select
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setSelectedAssemblyId(assembly.id);
                              setAssemblyDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteAssembly(assembly.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!assemblies || assemblies.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No assemblies found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            )}
          </Tabs>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>Cost Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => calculatePricing("cost_price", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Margin % *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.margin_percentage}
                  onChange={(e) => calculatePricing("margin_percentage", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Sell Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sell_price}
                  onChange={(e) => calculatePricing("sell_price", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Update" : "Create"} Item
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <AssemblyDialog
      open={assemblyDialogOpen}
      onOpenChange={(open) => {
        setAssemblyDialogOpen(open);
        if (!open) {
          setSelectedAssemblyId(undefined);
          queryClient.invalidateQueries({ queryKey: ["price-book-assemblies"] });
        }
      }}
      assemblyId={selectedAssemblyId}
    />
    </>
  );
}
