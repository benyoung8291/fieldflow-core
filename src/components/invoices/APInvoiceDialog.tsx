import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface APInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId?: string;
  onSuccess?: () => void;
}

export default function APInvoiceDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  onSuccess,
}: APInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState("");
  const [selectedPOId, setSelectedPOId] = useState(purchaseOrderId || "");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Fetch purchase orders
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders-for-ap'],
    queryFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(name)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch PO details when selected
  useEffect(() => {
    if (selectedPOId) {
      fetchPODetails(selectedPOId);
    }
  }, [selectedPOId]);

  const fetchPODetails = async (poId: string) => {
    try {
      // @ts-ignore - Types will update after migration
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(*), line_items:purchase_order_line_items(*)')
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      // Pre-populate line items from PO
      // @ts-ignore - Types will update after migration
      const items = po.line_items?.map((line: any) => ({
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total,
        po_line_id: line.id,
      })) || [];

      setLineItems(items);
    } catch (error) {
      console.error('Error fetching PO details:', error);
      toast.error('Failed to load purchase order details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPOId) {
      toast.error('Please select a purchase order');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // @ts-ignore - Types will update after migration
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      // @ts-ignore - Types will update after migration
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('supplier_id')
        .eq('id', selectedPOId)
        .single();

      // Get next invoice number
      // @ts-ignore - Types will update after migration
      const invoiceNumber = await supabase.rpc('get_next_sequential_number', {
        p_tenant_id: profile?.tenant_id,
        p_entity_type: 'ap_invoice'
      }).then(res => res.data);

      const totalAmount = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);

      // Create AP invoice
      // @ts-ignore - Types will update after migration
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          // @ts-ignore - Types will update after migration
          invoice_type: 'AP',
          // @ts-ignore - Types will update after migration
          supplier_invoice_number: supplierInvoiceNumber,
          // @ts-ignore - Types will update after migration
          purchase_order_id: selectedPOId,
          // @ts-ignore - Types will update after migration
          supplier_id: po?.supplier_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          total_amount: totalAmount,
          status: 'pending',
          notes: notes,
          customer_id: po?.supplier_id, // Required field, using supplier as placeholder
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsData = lineItems.map((item, index) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        // @ts-ignore - Types will update after migration
        line_number: index + 1,
        // @ts-ignore - Types will update after migration
        item_code: item.item_code,
      }));

      // @ts-ignore - Types will update after migration
      const { error: linesError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsData);

      if (linesError) throw linesError;

      // Perform 3-way matching
      // @ts-ignore - Types will update after migration
      const { data: matchResult } = await supabase.rpc('perform_three_way_match', {
        p_invoice_id: invoice.id,
        p_tolerance_percentage: 5.0
      });

      toast.success('AP Invoice created successfully');
      
      // @ts-ignore - Types will update after migration
      if (matchResult?.matching_status === 'variance') {
        toast.warning('Variances detected - review required');
      }

      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating AP invoice:', error);
      toast.error(error.message || 'Failed to create AP invoice');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSupplierInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate("");
    setNotes("");
    setLineItems([]);
    if (!purchaseOrderId) {
      setSelectedPOId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create AP Invoice</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            AP (Accounts Payable) invoices are for bills received from suppliers. The system will automatically perform 3-way matching with the purchase order and receipts.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-order">Purchase Order *</Label>
              <Select
                value={selectedPOId}
                onValueChange={setSelectedPOId}
                disabled={!!purchaseOrderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po: any) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-invoice-number">Supplier Invoice # *</Label>
              <Input
                id="supplier-invoice-number"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="Enter supplier's invoice number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-date">Invoice Date *</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date *</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Badge variant="secondary">
                {lineItems.length} items
              </Badge>
            </div>

            <Card>
              <CardContent className="p-4">
                {lineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select a purchase order to load line items
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-4 gap-3">
                          <div className="col-span-2">
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={item.description}
                              onChange={(e) => {
                                const newItems = [...lineItems];
                                newItems[index].description = e.target.value;
                                setLineItems(newItems);
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...lineItems];
                                newItems[index].quantity = parseFloat(e.target.value) || 0;
                                newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price;
                                setLineItems(newItems);
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const newItems = [...lineItems];
                                newItems[index].unit_price = parseFloat(e.target.value) || 0;
                                newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price;
                                setLineItems(newItems);
                              }}
                              className="h-8"
                            />
                          </div>
                        </div>
                        <div className="text-sm font-medium pt-5">
                          ${item.line_total?.toFixed(2) || '0.00'}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 mt-5"
                          onClick={() => {
                            setLineItems(lineItems.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="font-semibold">Total:</span>
                      <span className="text-lg font-bold">
                        ${lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedPOId || lineItems.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create AP Invoice
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
