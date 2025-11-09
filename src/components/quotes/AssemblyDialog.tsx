import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AssemblyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assemblyId?: string;
}

interface AssemblyItem {
  description: string;
  quantity: string;
  cost_price: string;
  margin_percentage: string;
  sell_price: string;
}

export default function AssemblyDialog({ open, onOpenChange, assemblyId }: AssemblyDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    notes: "",
  });

  const [items, setItems] = useState<AssemblyItem[]>([
    { description: "", quantity: "1", cost_price: "0", margin_percentage: "30", sell_price: "0" },
  ]);

  useEffect(() => {
    if (open && assemblyId) {
      fetchAssembly();
    } else if (open) {
      resetForm();
    }
  }, [open, assemblyId]);

  const fetchAssembly = async () => {
    setLoading(true);
    const { data: assemblyData, error } = await supabase
      .from("price_book_assemblies")
      .select("*")
      .eq("id", assemblyId)
      .single();

    if (error) {
      toast({ title: "Error fetching assembly", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: itemsData } = await supabase
      .from("price_book_assembly_items")
      .select("*")
      .eq("assembly_id", assemblyId)
      .order("item_order");

    if (assemblyData) {
      setFormData({
        code: assemblyData.code,
        name: assemblyData.name,
        description: assemblyData.description || "",
        category: assemblyData.category || "",
        notes: assemblyData.notes || "",
      });

      if (itemsData && itemsData.length > 0) {
        setItems(itemsData.map(item => ({
          description: item.description,
          quantity: item.quantity.toString(),
          cost_price: item.cost_price.toString(),
          margin_percentage: item.margin_percentage.toString(),
          sell_price: item.sell_price.toString(),
        })));
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      category: "",
      notes: "",
    });
    setItems([{ description: "", quantity: "1", cost_price: "0", margin_percentage: "30", sell_price: "0" }]);
  };

  const calculatePricing = (cost: string, margin: string, sell: string, changedField: string) => {
    const costNum = parseFloat(cost) || 0;
    const marginNum = parseFloat(margin) || 0;
    const sellNum = parseFloat(sell) || 0;

    if (changedField === "cost_price" || changedField === "margin_percentage") {
      return (costNum * (1 + marginNum / 100)).toFixed(2);
    } else {
      return costNum > 0 ? (((sellNum - costNum) / costNum) * 100).toFixed(2) : "0";
    }
  };

  const updateItem = (index: number, field: keyof AssemblyItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "cost_price" || field === "margin_percentage") {
      updated[index].sell_price = calculatePricing(
        updated[index].cost_price,
        updated[index].margin_percentage,
        updated[index].sell_price,
        field
      );
    } else if (field === "sell_price") {
      updated[index].margin_percentage = calculatePricing(
        updated[index].cost_price,
        updated[index].margin_percentage,
        value,
        field
      );
    }

    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: "1", cost_price: "0", margin_percentage: "30", sell_price: "0" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
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

      const assemblyData = {
        tenant_id: profile?.tenant_id,
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        notes: formData.notes || null,
      };

      let savedAssemblyId = assemblyId;

      if (assemblyId) {
        const { error } = await supabase
          .from("price_book_assemblies")
          .update(assemblyData)
          .eq("id", assemblyId);
        if (error) throw error;

        await supabase
          .from("price_book_assembly_items")
          .delete()
          .eq("assembly_id", assemblyId);
      } else {
        const { data: newAssembly, error } = await supabase
          .from("price_book_assemblies")
          .insert([assemblyData])
          .select()
          .single();
        if (error) throw error;
        savedAssemblyId = newAssembly.id;
      }

      const itemsData = items.map((item, index) => ({
        assembly_id: savedAssemblyId,
        description: item.description,
        quantity: parseFloat(item.quantity),
        cost_price: parseFloat(item.cost_price),
        margin_percentage: parseFloat(item.margin_percentage),
        sell_price: parseFloat(item.sell_price),
        item_order: index,
      }));

      const { error: itemsError } = await supabase
        .from("price_book_assembly_items")
        .insert(itemsData);

      if (itemsError) throw itemsError;

      toast({ title: `Assembly ${assemblyId ? "updated" : "created"} successfully` });
      queryClient.invalidateQueries({ queryKey: ["price-book-assemblies"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving assembly",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assemblyId ? "Edit" : "Create"} Assembly</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label>Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Assembly Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px] text-right">Qty</TableHead>
                    <TableHead className="w-[120px] text-right">Cost</TableHead>
                    <TableHead className="w-[100px] text-right">Margin %</TableHead>
                    <TableHead className="w-[120px] text-right">Sell</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Item description"
                          className="border-0 focus-visible:ring-0 bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          className="border-0 focus-visible:ring-0 text-right bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.cost_price}
                          onChange={(e) => updateItem(index, "cost_price", e.target.value)}
                          className="border-0 focus-visible:ring-0 text-right bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.margin_percentage}
                          onChange={(e) => updateItem(index, "margin_percentage", e.target.value)}
                          className="border-0 focus-visible:ring-0 text-right bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.sell_price}
                          onChange={(e) => updateItem(index, "sell_price", e.target.value)}
                          className="border-0 focus-visible:ring-0 text-right bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {assemblyId ? "Update" : "Create"} Assembly
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
