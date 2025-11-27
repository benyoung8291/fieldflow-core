import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Calendar, 
  MapPin, 
  ClipboardList,
  DollarSign,
  FileText,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceOrderDetailProps {
  orderId: string;
}

export function ServiceOrderDetail({ orderId }: ServiceOrderDetailProps) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["service-order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          location:customer_locations!service_orders_customer_location_id_fkey(
            name,
            address,
            city,
            state,
            postcode,
            formatted_address
          ),
          appointments(
            id,
            title,
            start_time,
            status
          )
        `)
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Service order not found</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-info/10 text-info border-info/20";
      case "pending":
        return "bg-warning/10 text-warning border-warning/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <CardHeader className="relative">
          <div className="flex flex-col gap-4">
            <Badge 
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold border self-start",
                getStatusColor(order.status)
              )}
            >
              {formatStatus(order.status)}
            </Badge>
            <div>
              <CardTitle className="text-2xl md:text-3xl">Service Order #{order.order_number}</CardTitle>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-semibold">
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {order.preferred_date && (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-info/10 p-2">
                  <Clock className="h-4 w-4 text-info" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Preferred Date</p>
                  <p className="text-sm font-semibold">
                    {new Date(order.preferred_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {order.total_amount !== null && order.total_amount !== undefined && (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-success/10 p-2">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-sm font-semibold">
                    ${order.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-warning/10 p-2">
                <ClipboardList className="h-4 w-4 text-warning" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Appointments</p>
                <p className="text-sm font-semibold">
                  {order.appointments?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {order.description && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{order.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Location */}
      {order.location && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Service Location</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="font-semibold">{order.location.name}</p>
              {order.location.formatted_address ? (
                <p className="text-sm text-muted-foreground">
                  {order.location.formatted_address}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.location.address}
                  {order.location.city && `, ${order.location.city}`}
                  {order.location.state && ` ${order.location.state}`}
                  {order.location.postcode && ` ${order.location.postcode}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointments */}
      {order.appointments && order.appointments.length > 0 && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Related Appointments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.appointments.map((apt: any) => (
                <div key={apt.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 hover-lift">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{apt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(apt.start_time).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <Badge 
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-xs",
                      getStatusColor(apt.status)
                    )}
                  >
                    {formatStatus(apt.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
