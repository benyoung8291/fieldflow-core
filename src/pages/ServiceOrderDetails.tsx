import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, User, FileText, DollarSign, Clock, Edit, Mail, Phone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import ServiceOrderAttachments from "@/components/service-orders/ServiceOrderAttachments";
import AuditTimeline from "@/components/audit/AuditTimeline";
import AppointmentsTab from "@/components/service-orders/AppointmentsTab";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
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
  const [dialogOpen, setDialogOpen] = useState(false);

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
              {order.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className={priorityColors[order.priority as keyof typeof priorityColors]}>
              {order.priority}
            </Badge>
            <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                Total Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                ${order.total_amount?.toFixed(2) || "0.00"}
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
              <CardHeader>
                <CardTitle className="text-base">Appointments & Time Logs</CardTitle>
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
    </DashboardLayout>
  );
}
