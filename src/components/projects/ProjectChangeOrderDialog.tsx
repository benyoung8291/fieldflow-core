import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import PriceBookDialog from "@/components/quotes/PriceBookDialog";
import { formatCurrency } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  schedule_impact_days: z.number().default(0),
});

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
  parent_line_item_id?: string;
  item_order: number;
}

interface ProjectChangeOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  changeOrder?: any;
  onSuccess: () => void;
}

export default function ProjectChangeOrderDialog({
  open,
  onOpenChange,
  projectId,
  changeOrder,
  onSuccess,
}: ProjectChangeOrderDialogProps) {
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showPriceBook, setShowPriceBook] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      reason: "",
      notes: "",
      schedule_impact_days: 0,
    },
  });

  useEffect(() => {
    const fetchTenantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (profile) setTenantId(profile.tenant_id);
      }
    };
    fetchTenantId();
  }, []);

  useEffect(() => {
    if (changeOrder) {
      form.reset({
        title: changeOrder.title,
        description: changeOrder.description || "",
        reason: changeOrder.reason || "",
        notes: changeOrder.notes || "",
        schedule_impact_days: changeOrder.schedule_impact_days || 0,
      });
      // Load line items
      loadLineItems();
    } else {
      form.reset({
        title: "",
        description: "",
        reason: "",
        notes: "",
        schedule_impact_days: 0,
      });
      setLineItems([]);
    }
  }, [changeOrder, form]);

  const loadLineItems = async () => {
    if (!changeOrder?.id) return;
    
    const { data, error } = await supabase
      .from("change_order_line_items")
      .select("*")
      .eq("change_order_id", changeOrder.id)
      .order("item_order");

    if (!error && data) {
      setLineItems(data);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        cost_price: 0,
        sell_price: 0,
        margin_percentage: 0,
        line_total: 0,
        is_from_price_book: false,
        item_order: lineItems.length,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate line total
    if (["quantity", "unit_price"].includes(field)) {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }
    
    // Recalculate margin if cost or sell price changes
    if (["cost_price", "sell_price", "unit_price"].includes(field)) {
      const sellPrice = updated[index].sell_price || updated[index].unit_price;
      const costPrice = updated[index].cost_price;
      if (sellPrice > 0) {
        updated[index].margin_percentage = ((sellPrice - costPrice) / sellPrice) * 100;
      }
    }
    
    setLineItems(updated);
  };

  const handlePriceBookSelect = (item: any) => {
    if (currentLineIndex !== null) {
      const updated = [...lineItems];
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
      setLineItems(updated);
    }
    setShowPriceBook(false);
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const totalCost = lineItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
    const totalMargin = subtotal - totalCost;
    const taxRate = 0.1; // 10% GST
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    
    return { subtotal, totalCost, totalMargin, taxAmount, total };
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const totals = calculateTotals();
      
      // Generate change order number
      const changeOrderNumber = await supabase.rpc("get_next_sequential_number", {
        p_tenant_id: tenantId,
        p_entity_type: "change_order",
      });

      const changeOrderData = {
        tenant_id: tenantId,
        project_id: projectId,
        change_order_number: changeOrder?.change_order_number || changeOrderNumber.data,
        title: values.title,
        description: values.description,
        reason: values.reason,
        notes: values.notes,
        schedule_impact_days: values.schedule_impact_days,
        subtotal: totals.subtotal,
        tax_rate: 10,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        total_cost: totals.totalCost,
        total_margin: totals.totalMargin,
        budget_impact: totals.total,
        requested_by: user.id,
        status: changeOrder?.status || "draft",
      };

      let changeOrderId = changeOrder?.id;

      if (changeOrder) {
        // Update existing
        const { error } = await supabase
          .from("project_change_orders")
          .update(changeOrderData)
          .eq("id", changeOrder.id);

        if (error) throw error;

        // Delete old line items
        await supabase
          .from("change_order_line_items")
          .delete()
          .eq("change_order_id", changeOrder.id);
      } else {
        // Create new
        const { data, error } = await supabase
          .from("project_change_orders")
          .insert(changeOrderData)
          .select()
          .single();

        if (error) throw error;
        changeOrderId = data.id;
      }

      // Insert line items
      const lineItemsToInsert = lineItems.map((item, index) => ({
        ...item,
        change_order_id: changeOrderId,
        tenant_id: tenantId,
        item_order: index,
      }));

      const { error: lineItemsError } = await supabase
        .from("change_order_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      toast({
        title: "Success",
        description: `Change order ${changeOrder ? "updated" : "created"} successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const totals = calculateTotals();
  const isApproved = changeOrder?.status === "approved";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {changeOrder ? (isApproved ? "View" : "Edit") : "Create"} Change Order
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isApproved} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="schedule_impact_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Impact (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          disabled={isApproved}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isApproved} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Change</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isApproved} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  {!isApproved && (
                    <Button type="button" onClick={addLineItem} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line Item
                    </Button>
                  )}
                </div>

                {lineItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid gap-3 md:grid-cols-6">
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">Description</label>
                          <div className="flex gap-2">
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              disabled={isApproved}
                            />
                            {!isApproved && (
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
                            disabled={isApproved}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Unit Price</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                            disabled={isApproved}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Cost</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.cost_price}
                            onChange={(e) => updateLineItem(index, "cost_price", parseFloat(e.target.value) || 0)}
                            disabled={isApproved}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Total</label>
                          <Input
                            type="number"
                            value={formatCurrency(item.line_total)}
                            disabled
                          />
                        </div>
                      </div>
                      {!isApproved && (
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

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (10%):</span>
                  <span>{formatCurrency(totals.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Margin:</span>
                  <span>{formatCurrency(totals.totalMargin)}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isApproved} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {isApproved ? "Close" : "Cancel"}
                </Button>
                {!isApproved && (
                  <Button type="submit">
                    {changeOrder ? "Update" : "Create"} Change Order
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <PriceBookDialog
        open={showPriceBook}
        onOpenChange={setShowPriceBook}
        onSelectItem={handlePriceBookSelect}
        allowAssemblies={false}
      />
    </>
  );
}
