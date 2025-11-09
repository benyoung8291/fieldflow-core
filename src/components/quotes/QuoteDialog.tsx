import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

const quoteSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  valid_until: z.string().optional(),
  tax_rate: z.string().optional(),
  discount_amount: z.string().optional(),
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
  terms_conditions: z.string().max(2000, "Terms must be less than 2000 characters").optional(),
});

const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  quantity: z.string().min(1, "Quantity is required"),
  unit_price: z.string().min(1, "Unit price is required"),
});

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId?: string;
}

interface LineItem {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: number;
}

export default function QuoteDialog({ open, onOpenChange, quoteId }: QuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    customer_id: "",
    title: "",
    description: "",
    valid_until: "",
    tax_rate: "10",
    discount_amount: "0",
    notes: "",
    terms_conditions: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unit_price: "0", line_total: 0 },
  ]);

  useEffect(() => {
    if (open) {
      fetchCustomers();
      if (quoteId) {
        fetchQuote();
      } else {
        resetForm();
      }
    }
  }, [open, quoteId]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast({ title: "Error fetching customers", variant: "destructive" });
    } else {
      setCustomers(data || []);
    }
  };

  const fetchQuote = async () => {
    setLoading(true);
    const { data: quoteData, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError) {
      toast({ title: "Error fetching quote", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("item_order");

    if (itemsError) {
      toast({ title: "Error fetching quote items", variant: "destructive" });
    }

    if (quoteData) {
      setFormData({
        customer_id: quoteData.customer_id || "",
        title: quoteData.title || "",
        description: quoteData.description || "",
        valid_until: quoteData.valid_until || "",
        tax_rate: quoteData.tax_rate?.toString() || "10",
        discount_amount: quoteData.discount_amount?.toString() || "0",
        notes: quoteData.notes || "",
        terms_conditions: quoteData.terms_conditions || "",
      });

      if (itemsData && itemsData.length > 0) {
        setLineItems(
          itemsData.map((item: any) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.unit_price.toString(),
            line_total: item.line_total,
          }))
        );
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      title: "",
      description: "",
      valid_until: "",
      tax_rate: "10",
      discount_amount: "0",
      notes: "",
      terms_conditions: "",
    });
    setLineItems([{ description: "", quantity: "1", unit_price: "0", line_total: 0 }]);
    setErrors({});
  };

  const calculateLineTotal = (quantity: string, unitPrice: string): number => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "quantity" || field === "unit_price") {
      updated[index].line_total = calculateLineTotal(
        field === "quantity" ? value : updated[index].quantity,
        field === "unit_price" ? value : updated[index].unit_price
      );
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: "1", unit_price: "0", line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = parseFloat(formData.tax_rate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const discount = parseFloat(formData.discount_amount) || 0;
    const total = subtotal + taxAmount - discount;

    return { subtotal, taxAmount, total };
  };

  const validateForm = () => {
    try {
      quoteSchema.parse(formData);
      
      lineItems.forEach((item, index) => {
        lineItemSchema.parse(item);
      });

      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
        toast({ title: "Please fix validation errors", variant: "destructive" });
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      const { subtotal, taxAmount, total } = calculateTotals();

      const quoteData: any = {
        customer_id: formData.customer_id,
        title: formData.title,
        description: formData.description || null,
        valid_until: formData.valid_until || null,
        subtotal,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        tax_amount: taxAmount,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        total_amount: total,
        notes: formData.notes || null,
        terms_conditions: formData.terms_conditions || null,
      };

      let savedQuoteId = quoteId;

      if (quoteId) {
        const { error } = await supabase.from("quotes").update(quoteData).eq("id", quoteId);
        if (error) throw error;

        await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);
      } else {
        quoteData.created_by = user.id;
        quoteData.quote_number = `QT-${Date.now()}`;

        const { data: newQuote, error } = await supabase
          .from("quotes")
          .insert([quoteData])
          .select()
          .single();

        if (error) throw error;
        savedQuoteId = newQuote.id;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const lineItemsData = lineItems.map((item, index) => ({
        quote_id: savedQuoteId,
        tenant_id: profile?.tenant_id,
        item_order: index,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        line_total: item.line_total,
      }));

      const { error: itemsError } = await supabase
        .from("quote_line_items")
        .insert(lineItemsData);

      if (itemsError) throw itemsError;

      toast({ title: `Quote ${quoteId ? "updated" : "created"} successfully` });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", savedQuoteId] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving quote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quoteId ? "Edit" : "Create"} Quote</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
              >
                <SelectTrigger className={errors.customer_id ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customer_id && <p className="text-sm text-red-500">{errors.customer_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-start p-4 border rounded-lg">
                <div className="col-span-5 space-y-2">
                  <Label>Description *</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Total</Label>
                  <Input value={`$${item.line_total.toFixed(2)}`} disabled />
                </div>
                <div className="col-span-1 flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_amount">Discount ($)</Label>
              <Input
                id="discount_amount"
                type="number"
                step="0.01"
                value={formData.discount_amount}
                onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({formData.tax_rate}%):</span>
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount:</span>
              <span className="font-medium">-${parseFloat(formData.discount_amount || "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms_conditions">Terms & Conditions</Label>
            <Textarea
              id="terms_conditions"
              value={formData.terms_conditions}
              onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {quoteId ? "Update" : "Create"} Quote
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
