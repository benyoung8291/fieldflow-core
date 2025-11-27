import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

const formSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  invoice_number_prefix: z.string().min(1, "Prefix is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval_count: z.number().min(1),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  tax_rate: z.number().min(0).max(100),
  payment_terms: z.number().min(0),
  notes: z.string().optional(),
  is_active: z.boolean(),
});

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface RecurringInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringInvoiceId?: string;
}

export function RecurringInvoiceDialog({
  open,
  onOpenChange,
  recurringInvoiceId,
}: RecurringInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingInvoice } = useQuery({
    queryKey: ["recurring-invoice", recurringInvoiceId],
    enabled: !!recurringInvoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select(`
          *,
          recurring_invoice_line_items (*)
        `)
        .eq("id", recurringInvoiceId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      invoice_number_prefix: "",
      frequency: "monthly",
      interval_count: 1,
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      tax_rate: 10,
      payment_terms: 30,
      notes: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (existingInvoice) {
      form.reset({
        customer_id: existingInvoice.customer_id,
        invoice_number_prefix: existingInvoice.invoice_number_prefix,
        frequency: existingInvoice.frequency as any,
        interval_count: existingInvoice.interval_count,
        start_date: existingInvoice.start_date,
        end_date: existingInvoice.end_date || "",
        tax_rate: existingInvoice.tax_rate,
        payment_terms: existingInvoice.payment_terms,
        notes: existingInvoice.notes || "",
        is_active: existingInvoice.is_active,
      });
      if (existingInvoice.recurring_invoice_line_items) {
        setLineItems(existingInvoice.recurring_invoice_line_items);
      }
    }
  }, [existingInvoice, form]);

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      if (!profile?.tenant_id) {
        throw new Error("Unable to determine tenant. Please refresh and try again.");
      }

      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const tax_amount = subtotal * (values.tax_rate / 100);
      const total_amount = subtotal + tax_amount;

      const { data: recurringInvoice, error: invoiceError } = await supabase
        .from("recurring_invoices")
        .insert({
          customer_id: values.customer_id,
          invoice_number_prefix: values.invoice_number_prefix,
          frequency: values.frequency,
          interval_count: values.interval_count,
          start_date: values.start_date,
          end_date: values.end_date || null,
          next_invoice_date: values.start_date,
          is_active: values.is_active,
          tax_rate: values.tax_rate,
          payment_terms: values.payment_terms,
          notes: values.notes || null,
          tenant_id: profile.tenant_id,
          created_by: user.id,
          subtotal,
          tax_amount,
          total_amount,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { error: lineItemsError } = await supabase
        .from("recurring_invoice_line_items")
        .insert(
          lineItems.map((item, index) => ({
            recurring_invoice_id: recurringInvoice.id,
            tenant_id: profile.tenant_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.quantity * item.unit_price,
            item_order: index,
          }))
        );

      if (lineItemsError) throw lineItemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      toast.success("Recurring invoice created successfully");
      onOpenChange(false);
      form.reset();
      setLineItems([{ description: "", quantity: 1, unit_price: 0 }]);
    },
    onError: (error) => {
      toast.error("Failed to create recurring invoice");
      console.error(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const tax_amount = subtotal * (values.tax_rate / 100);
      const total_amount = subtotal + tax_amount;

      const { error: invoiceError } = await supabase
        .from("recurring_invoices")
        .update({
          ...values,
          subtotal,
          tax_amount,
          total_amount,
        })
        .eq("id", recurringInvoiceId);

      if (invoiceError) throw invoiceError;

      // Delete existing line items and insert new ones
      const { error: deleteError } = await supabase
        .from("recurring_invoice_line_items")
        .delete()
        .eq("recurring_invoice_id", recurringInvoiceId);

      if (deleteError) throw deleteError;

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id)
        .single();

      const { error: lineItemsError } = await supabase
        .from("recurring_invoice_line_items")
        .insert(
          lineItems.map((item, index) => ({
            recurring_invoice_id: recurringInvoiceId,
            tenant_id: profile?.tenant_id!,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.quantity * item.unit_price,
            item_order: index,
          }))
        );

      if (lineItemsError) throw lineItemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-invoice", recurringInvoiceId] });
      toast.success("Recurring invoice updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update recurring invoice");
      console.error(error);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (lineItems.length === 0 || !lineItems[0].description) {
      toast.error("Please add at least one line item");
      return;
    }

    if (recurringInvoiceId) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recurringInvoiceId ? "Edit" : "Create"} Recurring Invoice
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_number_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number Prefix</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-REC-" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interval_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Every</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Line Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value))}
                    className="w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value))}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable automatic invoice generation
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {recurringInvoiceId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
