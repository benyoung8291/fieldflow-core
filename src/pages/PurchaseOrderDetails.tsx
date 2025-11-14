import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  MoreVertical, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Send,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import { ReceiptDialog } from "@/components/purchase-orders/ReceiptDialog";
import AuditTimeline from "@/components/audit/AuditTimeline";
import { canApplyGST, getGSTWarning } from "@/lib/gstCompliance";

export default function PurchaseOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchaseOrder, setPurchaseOrder] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder();
    }
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(*)
        `)
        .eq("id", id)
        .single();

      if (poError) throw poError;

      setPurchaseOrder(po);
      setSupplier(po.suppliers);

      // Fetch line items
      const { data: items, error: itemsError } = await supabase
        .from("purchase_order_line_items")
        .select("*")
        .eq("po_id", id)
        .order("item_order");

      if (itemsError) throw itemsError;
      setLineItems(items || []);

      // Fetch receipts
      const { data: receiptData, error: receiptsError } = await supabase
        .from("po_receipts")
        .select(`
          *,
          po_receipt_line_items(
            *,
            purchase_order_line_items(description)
          )
        `)
        .eq("po_id", id)
        .order("receipt_date", { ascending: false });

      if (receiptsError) throw receiptsError;
      setReceipts(receiptData || []);
    } catch (error: any) {
      toast.error("Failed to load purchase order");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === "approved") {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = (await supabase.auth.getUser()).data.user?.id;
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast.success(`Purchase order ${newStatus}`);
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this purchase order?")) return;

    try {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Purchase order deleted");
      navigate("/purchase-orders");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-500",
      approved: "bg-blue-500",
      sent: "bg-purple-500",
      partially_received: "bg-yellow-500",
      fully_received: "bg-green-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const canEdit = purchaseOrder?.status === "draft";
  const canApprove = purchaseOrder?.status === "draft";
  const canSend = purchaseOrder?.status === "approved";
  const canReceive = ["approved", "sent", "partially_received"].includes(purchaseOrder?.status);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">Purchase order not found</div>
      </DashboardLayout>
    );
  }

  const gstWarning = getGSTWarning(supplier);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{purchaseOrder.po_number}</h1>
            <p className="text-muted-foreground">{supplier?.name}</p>
          </div>
          <Badge className={getStatusColor(purchaseOrder.status)}>
            {purchaseOrder.status?.replace("_", " ").toUpperCase()}
          </Badge>
          {supplier?.gst_registered && (
            <Badge variant="outline">GST Registered</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canApprove && (
            <Button onClick={() => handleStatusChange("approved")}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {canSend && (
            <Button onClick={() => handleStatusChange("sent")}>
              <Send className="h-4 w-4 mr-2" />
              Mark as Sent
            </Button>
          )}
          {canReceive && (
            <Button onClick={() => setReceiptDialogOpen(true)}>
              <Package className="h-4 w-4 mr-2" />
              Record Receipt
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => handleStatusChange("cancelled")} className="text-destructive">
                Cancel PO
              </DropdownMenuItem>
              {purchaseOrder.status === "draft" && (
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {gstWarning && (
        <Card className="p-4 border-warning bg-warning/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">{gstWarning}</span>
          </div>
        </Card>
      )}

      {/* Key Information */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">PO Date</div>
          <div className="text-lg font-semibold">
            {new Date(purchaseOrder.po_date).toLocaleDateString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Expected Delivery</div>
          <div className="text-lg font-semibold">
            {purchaseOrder.expected_delivery_date 
              ? new Date(purchaseOrder.expected_delivery_date).toLocaleDateString()
              : "Not set"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Subtotal</div>
          <div className="text-lg font-semibold">${purchaseOrder.subtotal?.toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Amount</div>
          <div className="text-lg font-semibold">${purchaseOrder.total_amount?.toFixed(2)}</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="line-items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="line-items">Line Items</TabsTrigger>
          <TabsTrigger value="receipts">
            Receipts
            {receipts.length > 0 && (
              <Badge variant="secondary" className="ml-2">{receipts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="line-items">
          <Card className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>GST Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        {item.description}
                        {item.notes && (
                          <div className="text-sm text-muted-foreground">{item.notes}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={item.quantity_received >= item.quantity ? "default" : "outline"}
                      >
                        {item.quantity_received}
                      </Badge>
                    </TableCell>
                    <TableCell>${item.unit_price?.toFixed(2)}</TableCell>
                    <TableCell>${item.line_total?.toFixed(2)}</TableCell>
                    <TableCell>
                      {item.is_gst_free ? (
                        <Badge variant="outline">GST Free</Badge>
                      ) : (
                        <Badge>Incl. GST</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${purchaseOrder.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({purchaseOrder.tax_rate}%):</span>
                  <span>${purchaseOrder.tax_amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>${purchaseOrder.total_amount?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card className="p-6">
            {receipts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No receipts recorded yet</p>
              </div>
            ) : (
              <div className="space-y-6">
                {receipts.map((receipt) => (
                  <Card key={receipt.id} className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-semibold">
                          Receipt - {new Date(receipt.receipt_date).toLocaleDateString()}
                        </div>
                        {receipt.received_by && (
                          <div className="text-sm text-muted-foreground">
                            Received by: {receipt.received_by}
                          </div>
                        )}
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity Received</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receipt.po_receipt_line_items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {item.purchase_order_line_items?.description}
                            </TableCell>
                            <TableCell>{item.quantity_received}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {receipt.notes && (
                      <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                        {receipt.notes}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Supplier Information</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {supplier?.name}</div>
                  {supplier?.abn && (
                    <div><span className="text-muted-foreground">ABN:</span> {supplier.abn}</div>
                  )}
                  {supplier?.email && (
                    <div><span className="text-muted-foreground">Email:</span> {supplier.email}</div>
                  )}
                  {supplier?.phone && (
                    <div><span className="text-muted-foreground">Phone:</span> {supplier.phone}</div>
                  )}
                  <div>
                    <span className="text-muted-foreground">GST Status:</span>{" "}
                    {supplier?.gst_registered ? (
                      <Badge variant="outline">GST Registered</Badge>
                    ) : (
                      <Badge variant="outline">Not GST Registered</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Purchase Order Details</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">PO Number:</span> {purchaseOrder.po_number}</div>
                  <div><span className="text-muted-foreground">Status:</span> {purchaseOrder.status}</div>
                  <div><span className="text-muted-foreground">Created:</span> {new Date(purchaseOrder.created_at).toLocaleDateString()}</div>
                  {purchaseOrder.approved_at && (
                    <div><span className="text-muted-foreground">Approved:</span> {new Date(purchaseOrder.approved_at).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            </div>

            {purchaseOrder.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {purchaseOrder.notes}
                </div>
              </div>
            )}

            {purchaseOrder.internal_notes && (
              <div>
                <h3 className="font-semibold mb-2">Internal Notes</h3>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {purchaseOrder.internal_notes}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-6">
            <AuditTimeline tableName="purchase_orders" recordId={id!} />
          </Card>
        </TabsContent>
      </Tabs>

      <PurchaseOrderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        purchaseOrder={purchaseOrder}
        onSuccess={fetchPurchaseOrder}
      />

      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        purchaseOrder={purchaseOrder}
        onSuccess={fetchPurchaseOrder}
      />
      </div>
    </DashboardLayout>
  );
}
