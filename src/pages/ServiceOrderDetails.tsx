import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, User, FileText, DollarSign, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Order Details</CardTitle>
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

          {/* Customer & Location Info */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm font-medium">{order.customers?.name}</div>
                {order.customers?.email && (
                  <div className="text-xs text-muted-foreground">{order.customers.email}</div>
                )}
                {order.customers?.phone && (
                  <div className="text-xs text-muted-foreground">{order.customers.phone}</div>
                )}
              </CardContent>
            </Card>

            {order.customer_locations && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-sm font-medium">{order.customer_locations.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.customer_locations.address}
                    {order.customer_locations.city && `, ${order.customer_locations.city}`}
                    {order.customer_locations.state && ` ${order.customer_locations.state}`}
                    {order.customer_locations.postcode && ` ${order.customer_locations.postcode}`}
                  </div>
                </CardContent>
              </Card>
            )}

            {(order as any).assigned_profile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assigned To</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {(order as any).assigned_profile.first_name} {(order as any).assigned_profile.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">{(order as any).assigned_profile.email}</div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${order.total_amount?.toFixed(2) || "0.00"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">Line Items</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Line items will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Audit history will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
