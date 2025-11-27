import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CustomerAppointments() {
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("customer_id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["customer-appointments", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service_order:service_orders(
            id,
            service_order_number,
            customer_id,
            location:customer_locations(name, address)
          )
        `)
        .order("start_time", { ascending: false });

      if (error) throw error;
      
      // Filter to only appointments where the service order belongs to this customer
      return data?.filter((appointment: any) => 
        appointment.service_order?.customer_id === profile.customer_id
      ) || [];
    },
    enabled: !!profile?.customer_id,
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-info/10 text-info border-info/20";
      case "scheduled":
        return "bg-primary/10 text-primary border-primary/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-base text-muted-foreground">
            View scheduled and completed service appointments
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !appointments || appointments.length === 0 ? (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Appointments Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Appointments will appear here once they are scheduled
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment: any) => (
              <Card 
                key={appointment.id} 
                className="border-border/40 hover-lift card-interactive overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-semibold border",
                            getStatusColor(appointment.status)
                          )}
                        >
                          {formatStatus(appointment.status)}
                        </Badge>
                        {appointment.completion_reported_at && (
                          <Badge variant="outline" className="rounded-lg bg-success/5">
                            Work Completed
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base leading-tight">
                          {appointment.title}
                        </h3>
                        {appointment.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {appointment.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            {appointment.service_order?.location?.name || 'Unknown Location'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(appointment.start_time).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                          </span>
                        </div>
                      </div>

                      {appointment.completion_notes && (
                        <div className="mt-3 p-3 bg-success/5 border border-success/20 rounded-lg">
                          <p className="text-xs font-semibold text-success mb-1">Completion Notes</p>
                          <p className="text-xs text-muted-foreground">
                            {appointment.completion_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
}
