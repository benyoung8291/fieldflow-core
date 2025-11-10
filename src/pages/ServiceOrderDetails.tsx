import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, User, FileText, DollarSign, Clock, Edit, Mail, Phone, CheckCircle, XCircle, Receipt, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import ServiceOrderAttachments from "@/components/service-orders/ServiceOrderAttachments";
import AuditTimeline from "@/components/audit/AuditTimeline";
import AppointmentsTab from "@/components/service-orders/AppointmentsTab";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RelatedInvoicesCard from "@/components/invoices/RelatedInvoicesCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

const statusLabels: Record<string, string> = {
  draft: "Waiting",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export default function ServiceOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createAppointmentDialogOpen, setCreateAppointmentDialogOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [appointmentStartTime, setAppointmentStartTime] = useState("09:00");
  const [appointmentEndTime, setAppointmentEndTime] = useState("17:00");
  const [addToInvoiceDialogOpen, setAddToInvoiceDialogOpen] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["service_order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name, email, phone),
          customer_locations!service_orders_customer_location_id_fkey(name, address, city, state, postcode),
          customer_contacts(first_name, last_name, email, phone)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Fetch assigned worker separately if exists
      if ((data as any).assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", (data as any).assigned_to)
          .single();
        
        return { ...data, assigned_profile: profile };
      }
      
      return data;
    },
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ["service-order-line-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_line_items")
        .select("*")
        .eq("service_order_id", id)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["service-order-appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("service_order_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: draftInvoices = [] } = useQuery({
    queryKey: ["draft_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customers(name)")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  const totalCost = lineItems.reduce((sum: number, item: any) => sum + (item.cost_price || 0) * item.quantity, 0);
  const totalRevenue = lineItems.reduce((sum: number, item: any) => sum + item.line_total, 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const allAppointmentsCompleteOrCancelled = appointments.length > 0 && 
    appointments.every((apt: any) => apt.status === "completed" || apt.status === "cancelled");

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: "draft" | "scheduled" | "in_progress" | "completed" | "cancelled") => {
      const { error } = await supabase
        .from("service_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_order", id] });
      setCompleteConfirmOpen(false);
      toast({ title: "Service order status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  const handleCompleteOrder = () => {
    if (!allAppointmentsCompleteOrCancelled && appointments.length > 0) {
      toast({ 
        title: "Cannot complete order", 
        description: "All appointments must be completed or cancelled first",
        variant: "destructive"
      });
      return;
    }
    setCompleteConfirmOpen(true);
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      const startDateTime = new Date(`${appointmentDate}T${appointmentStartTime}`);
      const endDateTime = new Date(`${appointmentDate}T${appointmentEndTime}`);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("appointments")
        .insert({
          title: order?.title || "Appointment",
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "draft" as const,
          created_by: user.id,
          tenant_id: profile.tenant_id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-appointments", id] });
      setCreateAppointmentDialogOpen(false);
      toast({ title: "Appointment created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating appointment", description: error.message, variant: "destructive" });
    },
  });

  const addToInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      if (!profile) throw new Error("Profile not found");

      const invoiceLineItems = lineItems.map((item: any) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        source_type: "service_order",
        source_id: id,
        line_item_id: item.id,
        item_order: item.item_order,
        tenant_id: profile.tenant_id,
      }));

      const { error: insertError } = await supabase
        .from("invoice_line_items")
        .insert(invoiceLineItems);
      
      if (insertError) throw insertError;

      const { data: invoice } = await supabase
        .from("invoices")
        .select("subtotal, tax_rate")
        .eq("id", invoiceId)
        .single();

      const newSubtotal = (invoice?.subtotal || 0) + lineItems.reduce((sum: number, item: any) => sum + item.line_total, 0);
      const taxAmount = newSubtotal * ((invoice?.tax_rate || 0) / 100);
      const totalAmount = newSubtotal + taxAmount;

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          subtotal: newSubtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .eq("id", invoiceId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setAddToInvoiceDialogOpen(false);
      toast({ title: "Service order added to invoice" });
    },
    onError: (error: any) => {
      toast({ title: "Error adding to invoice", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading order details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Order not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/service-orders")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Service Order {order.order_number}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">{order.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusColors[order.status as keyof typeof statusColors]}>
              {statusLabels[order.status as keyof typeof statusLabels] || order.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className={priorityColors[order.priority as keyof typeof priorityColors]}>
              {order.priority}
            </Badge>
            {order.status === "completed" && order.billing_status !== "billed" && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate("/invoices/create", { state: { serviceOrderId: id } })}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Run Billing
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setAddToInvoiceDialogOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Add to Draft Invoice
                </Button>
              </>
            )}
            <Button 
              size="sm" 
              onClick={handleCompleteOrder}
              disabled={order.status === "completed"}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Order
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background z-50">
                <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Order
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updateOrderStatusMutation.mutate("draft")}>
                  Set to Waiting
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateOrderStatusMutation.mutate("cancelled")}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{order.customers?.name}</div>
              {order.customers?.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Mail className="h-3 w-3" />
                  {order.customers.email}
                </div>
              )}
              {order.customers?.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Phone className="h-3 w-3" />
                  {order.customers.phone}
                </div>
              )}
            </CardContent>
          </Card>

          {order.customer_locations && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">{order.customer_locations.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {order.customer_locations.address}
                </div>
                <div className="text-xs text-muted-foreground">
                  {order.customer_locations.city}, {order.customer_locations.state} {order.customer_locations.postcode}
                </div>
              </CardContent>
            </Card>
          )}

          {(order as any).assigned_profile && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Assigned To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">
                  {(order as any).assigned_profile.first_name} {(order as any).assigned_profile.last_name}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Mail className="h-3 w-3" />
                  {(order as any).assigned_profile.email}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                ${totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                ${totalCost.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Profit Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-success">
                ${totalProfit.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {profitMargin.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="appointments">Appointments & Time</TabsTrigger>
            <TabsTrigger value="items">Line Items ({lineItems.length})</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Start Date
                      </div>
                      <div className="text-sm">
                        {(order as any).start_date ? format(new Date((order as any).start_date), "PPP") : "Not set"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Estimated Duration
                      </div>
                      <div className="text-sm">{(order as any).estimated_duration || "Not set"}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Description
                    </div>
                    <div className="text-sm">{order.description || "No description"}</div>
                  </div>

                  {(order as any).internal_notes && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Internal Notes</div>
                      <div className="text-sm text-muted-foreground">{(order as any).internal_notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.customer_locations && (
                    <>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Site Address</div>
                        <div className="text-sm">
                          {order.customer_locations.address}
                          {order.customer_locations.city && <>, {order.customer_locations.city}</>}
                          {order.customer_locations.state && <> {order.customer_locations.state}</>}
                          {order.customer_locations.postcode && <> {order.customer_locations.postcode}</>}
                        </div>
                      </div>
                    </>
                  )}
                  {order.customer_contacts && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Site Contact</div>
                      <div className="text-sm font-medium">
                        {order.customer_contacts.first_name} {order.customer_contacts.last_name}
                      </div>
                      {order.customer_contacts.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Mail className="h-3 w-3" />
                          {order.customer_contacts.email}
                        </div>
                      )}
                      {order.customer_contacts.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          {order.customer_contacts.phone}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="appointments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Appointments & Time Logs</CardTitle>
                <Button size="sm" onClick={() => setCreateAppointmentDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </Button>
              </CardHeader>
              <CardContent>
                <AppointmentsTab serviceOrderId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No line items added yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${item.unit_price?.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.line_total?.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <ServiceOrderAttachments serviceOrderId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <RelatedInvoicesCard sourceType="service_order" sourceId={id!} />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit History</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTimeline tableName="service_orders" recordId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ServiceOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderId={id}
      />

      {/* Create Appointment Dialog */}
      <AlertDialog open={createAppointmentDialogOpen} onOpenChange={setCreateAppointmentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new appointment for {order?.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={appointmentStartTime}
                  onChange={(e) => setAppointmentStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={appointmentEndTime}
                  onChange={(e) => setAppointmentEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => createAppointmentMutation.mutate()}>
              Create Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Order Confirmation */}
      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Service Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this service order as completed? This will allow the order to be invoiced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateOrderStatusMutation.mutate("completed")}>
              Complete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Invoice Dialog */}
      <AlertDialog open={addToInvoiceDialogOpen} onOpenChange={setAddToInvoiceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add to Existing Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Select a draft invoice to add this service order's line items to
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select 
              onValueChange={(invoiceId) => {
                addToInvoiceMutation.mutate(invoiceId);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select draft invoice" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {draftInvoices.map((invoice: any) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.customers?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
