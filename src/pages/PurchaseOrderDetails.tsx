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
  Edit, 
  Trash2, 
  CheckCircle, 
  Send,
  Package,
  AlertTriangle,
  Link2,
  ExternalLink,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import { ReceiptDialog } from "@/components/purchase-orders/ReceiptDialog";
import { DeleteConfirmDialog } from "@/components/purchase-orders/DeleteConfirmDialog";
import { InlineEditableField } from "@/components/purchase-orders/InlineEditableField";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [linkedServiceOrder, setLinkedServiceOrder] = useState<any>(null);
  const [linkedProject, setLinkedProject] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder();
      fetchServiceOrders();
      fetchProjects();
    }
  }, [id]);

  const fetchServiceOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, order_number, title, status")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setServiceOrders(data || []);
    } catch (error: any) {
      console.error("Failed to fetch service orders:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, name, status")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error("Failed to fetch projects:", error);
    }
  };

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

      // Fetch linked service order
      if (po.service_order_id) {
        const { data: soData } = await supabase
          .from("service_orders")
          .select("id, order_number, title")
          .eq("id", po.service_order_id)
          .single();
        setLinkedServiceOrder(soData);
      }

      // Fetch linked project
      if (po.project_id) {
        const { data: projData } = await supabase
          .from("projects")
          .select("id, project_number, name")
          .eq("id", po.project_id)
          .single();
        setLinkedProject(projData);
      }

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

  const handleLinkServiceOrder = async (serviceOrderId: string) => {
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ 
          service_order_id: serviceOrderId || null,
          project_id: null // Clear project if linking to service order
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Purchase order linked to service order");
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLinkProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ 
          project_id: projectId || null,
          service_order_id: null // Clear service order if linking to project
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Purchase order linked to project");
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
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

  const handleUpdateField = async (field: string, value: string) => {
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ [field]: value || null })
        .eq("id", id);

      if (error) throw error;

      toast.success("Purchase order updated");
      fetchPurchaseOrder();
    } catch (error: any) {
      toast.error(error.message);
      throw error;
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
          {canEdit && (
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
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
          <Button 
            variant="outline" 
            onClick={() => handleStatusChange("cancelled")}
            className="text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel PO
          </Button>
          {purchaseOrder.status === "draft" && (
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
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
                <h3 className="font-semibold mb-4">Purchase Order Details</h3>
                <div className="space-y-3">
                  <InlineEditableField
                    label="PO Date"
                    value={purchaseOrder.po_date}
                    onSave={(value) => handleUpdateField("po_date", value)}
                    type="date"
                    readOnly={!canEdit}
                  />
                  <InlineEditableField
                    label="Expected Delivery Date"
                    value={purchaseOrder.expected_delivery_date}
                    onSave={(value) => handleUpdateField("expected_delivery_date", value)}
                    type="date"
                    readOnly={!canEdit}
                  />
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground mb-1">PO Number</div>
                    <div className="text-sm">{purchaseOrder.po_number}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <div className="text-sm">{purchaseOrder.status}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground mb-1">Created</div>
                    <div className="text-sm">{new Date(purchaseOrder.created_at).toLocaleDateString()}</div>
                  </div>
                  {purchaseOrder.approved_at && (
                    <div className="p-2">
                      <div className="text-xs text-muted-foreground mb-1">Approved</div>
                      <div className="text-sm">{new Date(purchaseOrder.approved_at).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {purchaseOrder.notes || canEdit ? (
              <div>
                <InlineEditableField
                  label="Notes"
                  value={purchaseOrder.notes}
                  onSave={(value) => handleUpdateField("notes", value)}
                  type="textarea"
                  readOnly={!canEdit}
                />
              </div>
            ) : null}

            {purchaseOrder.internal_notes || canEdit ? (
              <div>
                <InlineEditableField
                  label="Internal Notes"
                  value={purchaseOrder.internal_notes}
                  onSave={(value) => handleUpdateField("internal_notes", value)}
                  type="textarea"
                  readOnly={!canEdit}
                />
              </div>
            ) : null}

            {/* Linked Documents Section */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Linked Documents
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Service Order
                  </label>
                  {linkedServiceOrder ? (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-start"
                        onClick={() => navigate(`/service-orders/${linkedServiceOrder.id}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {linkedServiceOrder.order_number}: {linkedServiceOrder.title}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLinkServiceOrder("")}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <Select 
                      value={purchaseOrder.service_order_id || "none"}
                      onValueChange={handleLinkServiceOrder}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {serviceOrders.map((so) => (
                          <SelectItem key={so.id} value={so.id}>
                            {so.order_number}: {so.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Project
                  </label>
                  {linkedProject ? (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-start"
                        onClick={() => navigate(`/projects/${linkedProject.id}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {linkedProject.project_number}: {linkedProject.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLinkProject("")}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <Select 
                      value={purchaseOrder.project_id || "none"}
                      onValueChange={handleLinkProject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((proj) => (
                          <SelectItem key={proj.id} value={proj.id}>
                            {proj.project_number}: {proj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        itemName={purchaseOrder.po_number}
      />
      </div>
    </DashboardLayout>
  );
}
