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
    }));

    setLineItems(items);
  };

  const updateQuantityToReceive = (index: number, value: number) => {
    const updated = [...lineItems];
    const maxAllowed = updated[index].ordered_quantity - updated[index].received_quantity;
    updated[index].quantity_to_receive = Math.min(Math.max(0, value), maxAllowed);
    setLineItems(updated);
  };

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

      // Create receipt line items and update quantities
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

        // Update PO line item received quantity
        const { error: updateError } = await supabase
          .from("purchase_order_line_items")
          .update({
            quantity_received: item.received_quantity + item.quantity_to_receive,
          })
          .eq("id", item.line_item_id);

        if (updateError) throw updateError;
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Receipt - {purchaseOrder?.po_number}</DialogTitle>
        </DialogHeader>

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
              <h3 className="font-semibold">Line Items</h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="w-[15%]">Ordered</TableHead>
                      <TableHead className="w-[15%]">Previously Received</TableHead>
                      <TableHead className="w-[15%]">Remaining</TableHead>
                      <TableHead className="w-[15%]">Receive Now</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => {
                      const remaining = item.ordered_quantity - item.received_quantity;
                      return (
                        <TableRow key={item.line_item_id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.ordered_quantity}</TableCell>
                          <TableCell>{item.received_quantity}</TableCell>
                          <TableCell>
                            <Badge variant={remaining > 0 ? "outline" : "default"}>
                              {remaining}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity_to_receive}
                              onChange={(e) => updateQuantityToReceive(index, parseFloat(e.target.value) || 0)}
                              min="0"
                              max={remaining}
                              step="0.01"
                              disabled={remaining <= 0}
                            />
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
