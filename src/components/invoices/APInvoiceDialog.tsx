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
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartOfAccountsSelector } from "@/components/expenses/ChartOfAccountsSelector";
import { formatCurrency } from "@/lib/utils";

interface APInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId?: string;
  serviceOrderId?: string;
  projectId?: string;
  onSuccess?: () => void;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  account_code: string;
  sub_account?: string;
  is_gst_free?: boolean;
}

export default function APInvoiceDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  serviceOrderId,
  projectId,
  onSuccess,
}: APInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState(serviceOrderId || "");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || "");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-ap'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch purchase receipts
  const { data: receipts = [] } = useQuery({
    queryKey: ['purchase-receipts-for-ap'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      const { data: receiptsData, error: receiptsError } = await supabase
        .from("po_receipts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("receipt_date", { ascending: false });

      if (receiptsError) throw receiptsError;
      if (!receiptsData || receiptsData.length === 0) return [];

      const poIds = [...new Set(receiptsData.map(r => r.po_id))];
      const { data: posData, error: posError } = await supabase
        .from("purchase_orders")
        .select("id, po_number, supplier_id")
        .in("id", poIds);

      if (posError) throw posError;

      const supplierIds = [...new Set((posData || []).map(po => po.supplier_id).filter(Boolean))];
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds);

      if (suppliersError) throw suppliersError;

      const posMap = new Map(posData?.map(po => [po.id, po]) || []);
      const suppliersMap = new Map(suppliersData?.map(s => [s.id, s]) || []);

      return receiptsData.map(receipt => ({
        ...receipt,
        purchase_orders: {
          ...posMap.get(receipt.po_id),
          suppliers: suppliersMap.get(posMap.get(receipt.po_id)?.supplier_id)
        }
      }));
    },
  });

  // Fetch service orders
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ['service-orders-for-ap'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("service_orders")
        .select("id, order_number, title")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-ap'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, name")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch receipt details when selected
  useEffect(() => {
    if (selectedReceiptId) {
      fetchReceiptDetails(selectedReceiptId);
    }
  }, [selectedReceiptId]);

  const fetchReceiptDetails = async (receiptId: string) => {
    try {
      const { data: receipt, error: receiptError } = await supabase
        .from('po_receipts')
        .select('po_id')
        .eq('id', receiptId)
        .single();

      if (receiptError) throw receiptError;
      if (!receipt) throw new Error("Receipt not found");

      // Get PO to get supplier and service order/project linkage
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('supplier_id, service_order_id, project_id')
        .eq('id', receipt.po_id)
        .single();

      if (poError) throw poError;
      if (po?.supplier_id) {
        setSupplierId(po.supplier_id);
      }
      
      // Automatically populate service order or project from PO
      if (po?.service_order_id) {
        setSelectedServiceOrderId(po.service_order_id);
      }
      if (po?.project_id) {
        setSelectedProjectId(po.project_id);
      }

      const { data: receiptLineItems, error: lineItemsError } = await supabase
        .from('po_receipt_line_items')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('created_at');

      if (lineItemsError) throw lineItemsError;
      if (!receiptLineItems || receiptLineItems.length === 0) {
        setLineItems([]);
        return;
      }

      const poLineItemIds = [...new Set(receiptLineItems.map(line => line.po_line_item_id))];
      const { data: poLineItems, error: poLineItemsError } = await supabase
        .from('purchase_order_line_items')
        .select('id, description, unit_price, is_gst_free')
        .in('id', poLineItemIds);

      if (poLineItemsError) throw poLineItemsError;

      const poLineItemsMap = new Map(poLineItems?.map(line => [line.id, line]) || []);

      const items = receiptLineItems.map((line: any) => {
        const poLineItem = poLineItemsMap.get(line.po_line_item_id);
        return {
          description: poLineItem?.description || '',
          quantity: line.quantity_received,
          unit_price: poLineItem?.unit_price || 0,
          line_total: line.quantity_received * (poLineItem?.unit_price || 0),
          account_code: '',
          sub_account: '',
          is_gst_free: poLineItem?.is_gst_free || false,
        };
      });

      setLineItems(items);
    } catch (error) {
      console.error('Error fetching receipt details:', error);
      toast.error('Failed to load receipt details');
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      description: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      account_code: '',
      sub_account: '',
      is_gst_free: false,
    }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate line total if quantity or unit_price changed
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setLineItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    // Validate line items have account codes
    const missingAccounts = lineItems.some(item => !item.account_code);
    if (missingAccounts) {
      toast.error('Please select chart of accounts for all line items');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      // Get next invoice number
      const { data: invoiceNumberData } = await supabase.rpc('get_next_sequential_number', {
        p_tenant_id: profile?.tenant_id,
        p_entity_type: 'ap_invoice'
      });

      const subtotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
      const taxAmount = subtotal * 0.1; // Fixed 10% tax rate
      const totalAmount = subtotal + taxAmount;

      // Create AP invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('ap_invoices')
        .insert([{
          tenant_id: profile.tenant_id,
          invoice_number: invoiceNumberData || 'AP-001',
          supplier_id: supplierId,
          supplier_invoice_number: supplierInvoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          status: 'draft',
          notes: notes,
          created_by: user.id,
          purchase_receipt_id: selectedReceiptId || null,
          service_order_id: selectedServiceOrderId || null,
          project_id: selectedProjectId || null,
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsData = lineItems.map((item, index) => ({
        tenant_id: profile.tenant_id,
        ap_invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        item_order: index,
        account_code: item.account_code,
        sub_account: item.sub_account || null,
      }));

      const { error: linesError } = await supabase
        .from('ap_invoice_line_items')
        .insert(lineItemsData);

      if (linesError) throw linesError;

      toast.success('AP Invoice created successfully');
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
    setSupplierId("");
    setSupplierInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate("");
    setNotes("");
    setLineItems([]);
    setSelectedReceiptId("");
    setSelectedServiceOrderId(serviceOrderId || "");
    setSelectedProjectId(projectId || "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create AP Invoice</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            AP (Accounts Payable) invoices are for bills received from suppliers. You can create an invoice from a purchase receipt, or enter it manually.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select
                value={supplierId}
                onValueChange={setSupplierId}
                disabled={!!selectedReceiptId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-receipt">From Purchase Receipt (Optional)</Label>
              <Select
                value={selectedReceiptId}
                onValueChange={setSelectedReceiptId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Receipt (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  {receipts.map((receipt: any) => (
                    <SelectItem key={receipt.id} value={receipt.id}>
                      {receipt.receipt_number} - {receipt.purchase_orders?.suppliers?.name} ({new Date(receipt.receipt_date).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-order">Link to Service Order (Optional)</Label>
              <Select
                value={selectedServiceOrderId}
                onValueChange={setSelectedServiceOrderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Service Order (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  {serviceOrders.map((so: any) => (
                    <SelectItem key={so.id} value={so.id}>
                      {so.order_number} - {so.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Link to Project (Optional)</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Project (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.project_number} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {lineItems.length} items
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line Item
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                {lineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No line items. Click "Add Line Item" or select a purchase receipt to load line items.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium">Line Item {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-3">
                            <Label className="text-xs">Description *</Label>
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                              className="h-8"
                              placeholder="Item description"
                              required
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Quantity *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="h-8"
                              required
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Unit Price *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="h-8"
                              required
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Line Total</Label>
                            <Input
                              type="text"
                              value={formatCurrency(item.line_total)}
                              className="h-8"
                              disabled
                            />
                          </div>
                        </div>

                        <ChartOfAccountsSelector
                          accountCode={item.account_code}
                          subAccount={item.sub_account}
                          onAccountChange={(code) => updateLineItem(index, 'account_code', code)}
                          onSubAccountChange={(sub) => updateLineItem(index, 'sub_account', sub)}
                        />
                      </div>
                    ))}
                    
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="font-semibold">Total:</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0))}
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
            <Button type="submit" disabled={loading || !supplierId || lineItems.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create AP Invoice
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
