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
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { z } from "zod";
import PriceBookDialog from "./PriceBookDialog";

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

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId?: string;
}

interface LineItem {
  id?: string;
  description: string;
  quantity: string;
  cost_price: string;
  margin_percentage: string;
  sell_price: string;
  line_total: number;
  parent_line_item_id?: string;
  subItems?: LineItem[];
  expanded?: boolean;
}

export default function QuoteDialog({ open, onOpenChange, quoteId }: QuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priceBookOpen, setPriceBookOpen] = useState(false);
  const [selectedParentIndex, setSelectedParentIndex] = useState<number | null>(null);

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
    { 
      description: "", 
      quantity: "1", 
      cost_price: "0",
      margin_percentage: "30",
      sell_price: "0",
      line_total: 0,
      subItems: [],
      expanded: false
    },
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
        // Build hierarchical structure
        const parentItems = itemsData.filter(item => !item.parent_line_item_id);
        const hierarchicalItems = parentItems.map((parent: any) => {
          const subItems = itemsData
            .filter((item: any) => item.parent_line_item_id === parent.id)
            .map((sub: any) => ({
              id: sub.id,
              description: sub.description,
              quantity: sub.quantity.toString(),
              cost_price: sub.cost_price?.toString() || "0",
              margin_percentage: sub.margin_percentage?.toString() || "0",
              sell_price: sub.sell_price?.toString() || "0",
              line_total: sub.line_total,
            }));

          return {
            id: parent.id,
            description: parent.description,
            quantity: parent.quantity.toString(),
            cost_price: parent.cost_price?.toString() || "0",
            margin_percentage: parent.margin_percentage?.toString() || "0",
            sell_price: parent.sell_price?.toString() || "0",
            line_total: parent.line_total,
            subItems,
            expanded: subItems.length > 0,
          };
        });

        setLineItems(hierarchicalItems);
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
    setLineItems([{ 
      description: "", 
      quantity: "1", 
      cost_price: "0",
      margin_percentage: "30",
      sell_price: "0",
      line_total: 0,
      subItems: [],
      expanded: false
    }]);
    setErrors({});
  };

  const calculatePricing = (cost: string, margin: string, sell: string, changedField: string) => {
    const costNum = parseFloat(cost) || 0;
    const marginNum = parseFloat(margin) || 0;
    const sellNum = parseFloat(sell) || 0;

    if (changedField === "cost_price" || changedField === "margin_percentage") {
      return {
        cost_price: cost,
        margin_percentage: margin,
        sell_price: (costNum * (1 + marginNum / 100)).toFixed(2),
      };
    } else {
      const newMargin = costNum > 0 ? (((sellNum - costNum) / costNum) * 100).toFixed(2) : "0";
      return {
        cost_price: cost,
        margin_percentage: newMargin,
        sell_price: sell,
      };
    }
  };

  const calculateLineTotal = (item: LineItem): number => {
    const qty = parseFloat(item.quantity) || 0;
    
    if (item.subItems && item.subItems.length > 0) {
      // Calculate from sub-items
      const subTotal = item.subItems.reduce((sum, sub) => {
        const subQty = parseFloat(sub.quantity) || 0;
        const subSell = parseFloat(sub.sell_price) || 0;
        return sum + (subQty * subSell);
      }, 0);
      return qty * subTotal;
    } else {
      const sell = parseFloat(item.sell_price) || 0;
      return qty * sell;
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    const item = updated[index];
    
    if (field === "cost_price" || field === "margin_percentage" || field === "sell_price") {
      const pricing = calculatePricing(
        field === "cost_price" ? value : item.cost_price,
        field === "margin_percentage" ? value : item.margin_percentage,
        field === "sell_price" ? value : item.sell_price,
        field
      );
      updated[index] = { ...item, ...pricing };
    } else {
      updated[index] = { ...item, [field]: value };
    }

    updated[index].line_total = calculateLineTotal(updated[index]);
    setLineItems(updated);
  };

  const updateSubItem = (parentIndex: number, subIndex: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    const subItem = updated[parentIndex].subItems![subIndex];

    if (field === "cost_price" || field === "margin_percentage" || field === "sell_price") {
      const pricing = calculatePricing(
        field === "cost_price" ? value : subItem.cost_price,
        field === "margin_percentage" ? value : subItem.margin_percentage,
        field === "sell_price" ? value : subItem.sell_price,
        field
      );
      updated[parentIndex].subItems![subIndex] = { ...subItem, ...pricing };
    } else {
      updated[parentIndex].subItems![subIndex] = { ...subItem, [field]: value };
    }

    // Recalculate sub-item line total
    const qty = parseFloat(updated[parentIndex].subItems![subIndex].quantity) || 0;
    const sell = parseFloat(updated[parentIndex].subItems![subIndex].sell_price) || 0;
    updated[parentIndex].subItems![subIndex].line_total = qty * sell;

    // Recalculate parent line total
    updated[parentIndex].line_total = calculateLineTotal(updated[parentIndex]);
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      description: "", 
      quantity: "1", 
      cost_price: "0",
      margin_percentage: "30",
      sell_price: "0",
      line_total: 0,
      subItems: [],
      expanded: false
    }]);
  };

  const addSubItem = (parentIndex: number) => {
    const updated = [...lineItems];
    if (!updated[parentIndex].subItems) {
      updated[parentIndex].subItems = [];
    }
    updated[parentIndex].subItems!.push({
      description: "",
      quantity: "1",
      cost_price: "0",
      margin_percentage: "30",
      sell_price: "0",
      line_total: 0,
    });
    updated[parentIndex].expanded = true;
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const removeSubItem = (parentIndex: number, subIndex: number) => {
    const updated = [...lineItems];
    updated[parentIndex].subItems = updated[parentIndex].subItems!.filter((_, i) => i !== subIndex);
    updated[parentIndex].line_total = calculateLineTotal(updated[parentIndex]);
    setLineItems(updated);
  };

  const toggleExpanded = (index: number) => {
    const updated = [...lineItems];
    updated[index].expanded = !updated[index].expanded;
    setLineItems(updated);
  };

  const handlePriceBookSelect = (item: any) => {
    if (selectedParentIndex !== null) {
      // Add as sub-item
      const updated = [...lineItems];
      if (!updated[selectedParentIndex].subItems) {
        updated[selectedParentIndex].subItems = [];
      }
      updated[selectedParentIndex].subItems!.push({
        description: item.description,
        quantity: "1",
        cost_price: item.cost_price.toString(),
        margin_percentage: item.margin_percentage.toString(),
        sell_price: item.sell_price.toString(),
        line_total: item.sell_price,
      });
      updated[selectedParentIndex].expanded = true;
      updated[selectedParentIndex].line_total = calculateLineTotal(updated[selectedParentIndex]);
      setLineItems(updated);
    } else {
      // Add as line item
      setLineItems([...lineItems, {
        description: item.description,
        quantity: "1",
        cost_price: item.cost_price.toString(),
        margin_percentage: item.margin_percentage.toString(),
        sell_price: item.sell_price.toString(),
        line_total: item.sell_price,
        subItems: [],
        expanded: false,
      }]);
    }
    setSelectedParentIndex(null);
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

      // Save line items with hierarchy
      const allItems: any[] = [];
      let itemOrder = 0;

      for (const item of lineItems) {
        const parentItem = {
          quote_id: savedQuoteId,
          tenant_id: profile?.tenant_id,
          item_order: itemOrder++,
          description: item.description,
          quantity: parseFloat(item.quantity),
          cost_price: parseFloat(item.cost_price),
          margin_percentage: parseFloat(item.margin_percentage),
          sell_price: parseFloat(item.sell_price),
          line_total: item.line_total,
          unit_price: parseFloat(item.sell_price), // For compatibility
        };

        const { data: savedParent, error: parentError } = await supabase
          .from("quote_line_items")
          .insert([parentItem])
          .select()
          .single();

        if (parentError) throw parentError;

        // Save sub-items
        if (item.subItems && item.subItems.length > 0) {
          for (const subItem of item.subItems) {
            allItems.push({
              quote_id: savedQuoteId,
              tenant_id: profile?.tenant_id,
              parent_line_item_id: savedParent.id,
              item_order: itemOrder++,
              description: subItem.description,
              quantity: parseFloat(subItem.quantity),
              cost_price: parseFloat(subItem.cost_price),
              margin_percentage: parseFloat(subItem.margin_percentage),
              sell_price: parseFloat(subItem.sell_price),
              line_total: subItem.line_total,
              unit_price: parseFloat(subItem.sell_price),
            });
          }
        }
      }

      if (allItems.length > 0) {
        const { error: subItemsError } = await supabase
          .from("quote_line_items")
          .insert(allItems);

        if (subItemsError) throw subItemsError;
      }

      toast({ title: `Quote ${quoteId ? "updated" : "created"} successfully` });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", savedQuoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote-line-items"] });
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

  const hasSubItems = (item: LineItem) => item.subItems && item.subItems.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
                <Label>Line Items & Takeoffs</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedParentIndex(null);
                      setPriceBookOpen(true);
                    }}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Price Book
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>

              {lineItems.map((item, index) => (
                <div key={index} className="border rounded-lg">
                  <div className="grid grid-cols-12 gap-3 items-start p-4 bg-muted/20">
                    <div className="col-span-1 flex items-center gap-1">
                      {hasSubItems(item) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleExpanded(index)}
                        >
                          {item.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    <div className="col-span-3 space-y-2">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="col-span-1 space-y-2">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.cost_price}
                        onChange={(e) => updateLineItem(index, "cost_price", e.target.value)}
                        disabled={hasSubItems(item)}
                        className={hasSubItems(item) ? "bg-muted" : ""}
                      />
                    </div>
                    <div className="col-span-1 space-y-2">
                      <Label className="text-xs">Margin%</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.margin_percentage}
                        onChange={(e) => updateLineItem(index, "margin_percentage", e.target.value)}
                        disabled={hasSubItems(item)}
                        className={hasSubItems(item) ? "bg-muted" : ""}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Sell</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.sell_price}
                        onChange={(e) => updateLineItem(index, "sell_price", e.target.value)}
                        disabled={hasSubItems(item)}
                        className={hasSubItems(item) ? "bg-muted" : ""}
                      />
                    </div>
                    <div className="col-span-1 space-y-2">
                      <Label className="text-xs">Total</Label>
                      <Input value={`$${item.line_total.toFixed(2)}`} disabled className="bg-muted font-medium" />
                    </div>
                    <div className="col-span-1 flex items-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedParentIndex(index);
                          setPriceBookOpen(true);
                        }}
                        title="Add sub-item from price book"
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => addSubItem(index)}
                        title="Add sub-item"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
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

                  {/* Sub-items */}
                  {item.expanded && item.subItems && item.subItems.length > 0 && (
                    <div className="border-t bg-background/50">
                      {item.subItems.map((subItem, subIndex) => (
                        <div key={subIndex} className="grid grid-cols-12 gap-3 items-start p-3 pl-12 border-b last:border-b-0">
                          <div className="col-span-3 space-y-2">
                            <Input
                              value={subItem.description}
                              onChange={(e) => updateSubItem(index, subIndex, "description", e.target.value)}
                              placeholder="Sub-item description"
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-1 space-y-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={subItem.quantity}
                              onChange={(e) => updateSubItem(index, subIndex, "quantity", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={subItem.cost_price}
                              onChange={(e) => updateSubItem(index, subIndex, "cost_price", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-1 space-y-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={subItem.margin_percentage}
                              onChange={(e) => updateSubItem(index, subIndex, "margin_percentage", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={subItem.sell_price}
                              onChange={(e) => updateSubItem(index, subIndex, "sell_price", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Input 
                              value={`$${subItem.line_total.toFixed(2)}`} 
                              disabled 
                              className="bg-muted text-sm"
                            />
                          </div>
                          <div className="col-span-1 flex items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSubItem(index, subIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      <PriceBookDialog 
        open={priceBookOpen} 
        onOpenChange={setPriceBookOpen}
        onSelectItem={handlePriceBookSelect}
      />
    </>
  );
}
