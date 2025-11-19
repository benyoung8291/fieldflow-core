import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const formSchema = z.object({
  receipt_date: z.string(),
  received_by: z.string().optional(),
  notes: z.string().optional(),
});

interface LineItemReceipt {
  line_item_id: string;
  description: string;
  ordered_quantity: number;
  received_quantity: number;
  quantity_to_receive: number;
  unit_price: number;
  original_unit_price: number;
  is_gst_free: boolean;
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: any;
  onSuccess?: () => void;
}

export function ReceiptDialog({ open, onOpenChange, purchaseOrder, onSuccess }: ReceiptDialogProps) {
  const [lineItems, setLineItems] = useState<LineItemReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      receipt_date: new Date().toISOString().split("T")[0],
      received_by: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open && purchaseOrder) {
      fetchLineItems();
    }
  }, [open, purchaseOrder]);

  const fetchLineItems = async () => {
    const { data, error } = await supabase
      .from("purchase_order_line_items")
      .select("*")
      .eq("po_id", purchaseOrder.id)
      .order("item_order");

    if (error) {
      toast.error("Failed to load line items");
      return;
    }

    const items: LineItemReceipt[] = (data || []).map(item => ({
      line_item_id: item.id,
      description: item.description,
      ordered_quantity: item.quantity,
      received_quantity: item.quantity_received,
      quantity_to_receive: Math.max(0, item.quantity - item.quantity_received),
      unit_price: item.unit_price,
      original_unit_price: item.unit_price,
      is_gst_free: item.is_gst_free || false,
    }));

    setLineItems(items);
    setEditMode(false);
  };

  const updateQuantityToReceive = (index: number, value: number) => {
    const updated = [...lineItems];
    const maxAllowed = updated[index].ordered_quantity - updated[index].received_quantity;
    updated[index].quantity_to_receive = Math.min(Math.max(0, value), maxAllowed);
    setLineItems(updated);
  };

  const updateLineItemPrice = (index: number, value: number) => {
    const updated = [...lineItems];
    updated[index].unit_price = value;
    setLineItems(updated);
  };

  const updateLineItemQuantity = (index: number, value: number) => {
    const updated = [...lineItems];
    updated[index].ordered_quantity = Math.max(0, value);
    setLineItems(updated);
  };

  const calculateVariance = () => {
    const originalTotal = lineItems.reduce(
      (sum, item) => sum + item.original_unit_price * item.ordered_quantity,
      0
    );
    const currentTotal = lineItems.reduce(
      (sum, item) => sum + item.unit_price * item.ordered_quantity,
      0
    );
    return currentTotal - originalTotal;
  };

  const variance = calculateVariance();
  const hasVariance = Math.abs(variance) > 0.01;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const itemsToReceive = lineItems.filter((item) => item.quantity_to_receive > 0);
    
    if (itemsToReceive.length === 0) {
      toast.error("Enter quantity to receive for at least one item");
      return;
    }

    setLoading(true);

    try {
      // Create receipt
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const receiptNumber = `RCP-${Date.now()}`;
      const receivedBy = values.received_by || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || "Unknown";

      const { data: receipt, error: receiptError } = await supabase
        .from("po_receipts")
        .insert({
          po_id: purchaseOrder.id,
          tenant_id: profile?.tenant_id!,
          receipt_date: values.receipt_date,
          receipt_number: receiptNumber,
          received_by: receivedBy,
          notes: values.notes || null,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create receipt line items and update quantities AND prices if changed
      for (const item of itemsToReceive) {
        // Insert receipt line item
        const { error: lineError } = await supabase
          .from("po_receipt_line_items")
          .insert({
            receipt_id: receipt.id,
            po_line_item_id: item.line_item_id,
            tenant_id: profile?.tenant_id,
            quantity_received: item.quantity_to_receive,
          });

        if (lineError) throw lineError;

        // Update PO line item with new quantity received AND new pricing if changed
        const { error: updateError } = await supabase
          .from("purchase_order_line_items")
          .update({
            quantity_received: item.received_quantity + item.quantity_to_receive,
            quantity: item.ordered_quantity,
            unit_price: item.unit_price,
          })
          .eq("id", item.line_item_id);

        if (updateError) throw updateError;
      }

      // Recalculate PO totals
      const { data: allItems } = await supabase
        .from("purchase_order_line_items")
        .select("*")
        .eq("po_id", purchaseOrder.id);

      if (allItems) {
        const subtotal = allItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
        const taxRate = purchaseOrder.tax_rate || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const totalAmount = subtotal + taxAmount;

        await supabase
          .from("purchase_orders")
          .update({
            subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
          })
          .eq("id", purchaseOrder.id);
      }

      // Check if all items are fully received
      const { data: allLineItems } = await supabase
        .from("purchase_order_line_items")
        .select("quantity, quantity_received")
        .eq("po_id", purchaseOrder.id);

      const fullyReceived = allLineItems?.every(item => item.quantity_received >= item.quantity);
      const partiallyReceived = allLineItems?.some(item => item.quantity_received > 0);

      // Update PO status
      const newStatus = fullyReceived 
        ? "fully_received" 
        : partiallyReceived 
        ? "partially_received" 
        : purchaseOrder.status;

      await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", purchaseOrder.id);

      toast.success("Receipt recorded successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Receipt - {purchaseOrder?.po_number}</DialogTitle>
        </DialogHeader>

        {hasVariance && (
          <Card className="p-4 border-warning bg-warning/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <div className="flex-1">
                <span className="text-sm font-semibold text-warning">Cost Variance Detected</span>
                <p className="text-xs text-warning/80 mt-1">
                  {variance > 0 ? "Increase" : "Decrease"} of ${Math.abs(variance).toFixed(2)} from original PO
                </p>
              </div>
            </div>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="receipt_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="received_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received By</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Line Items</h3>
                <Button
                  type="button"
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? "Lock Items" : "Unlock to Match Invoice"}
                </Button>
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Description</TableHead>
                      <TableHead className="w-[12%]">Quantity</TableHead>
                      <TableHead className="w-[12%]">Unit Price</TableHead>
                      <TableHead className="w-[12%]">Previously Received</TableHead>
                      <TableHead className="w-[12%]">Remaining</TableHead>
                      <TableHead className="w-[12%]">Receive Now</TableHead>
                      <TableHead className="w-[10%]">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => {
                      const lineTotal = item.unit_price * item.ordered_quantity;
                      const originalLineTotal = item.original_unit_price * item.ordered_quantity;
                      const lineVariance = lineTotal - originalLineTotal;
                      const hasLineVariance = Math.abs(lineVariance) > 0.01;
                      const remaining = item.ordered_quantity - item.received_quantity;

                      return (
                        <TableRow key={item.line_item_id} className={hasLineVariance ? "bg-warning/5" : ""}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>
                            {editMode ? (
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={item.ordered_quantity}
                                onChange={(e) => updateLineItemQuantity(index, parseFloat(e.target.value) || 0)}
                                className="w-20"
                              />
                            ) : (
                              <Badge variant="outline">{item.ordered_quantity}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {editMode ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => updateLineItemPrice(index, parseFloat(e.target.value) || 0)}
                                className="w-24"
                              />
                            ) : (
                              <span className={hasLineVariance ? "text-warning font-semibold" : ""}>
                                ${item.unit_price.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.received_quantity}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge>{Math.max(0, remaining)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={Math.max(0, remaining)}
                              value={item.quantity_to_receive}
                              onChange={(e) => updateQuantityToReceive(index, parseInt(e.target.value) || 0)}
                              className="w-20"
                              disabled={remaining <= 0}
                            />
                          </TableCell>
                          <TableCell className={hasLineVariance ? "text-warning font-semibold" : ""}>
                            ${lineTotal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Receipt notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Recording..." : "Record Receipt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
