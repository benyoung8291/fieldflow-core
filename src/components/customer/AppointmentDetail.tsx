import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Calendar, 
  MapPin, 
  Clock,
  FileText,
  User,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentDetailProps {
  appointmentId: string;
}

export function AppointmentDetail({ appointmentId }: AppointmentDetailProps) {
  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment-detail", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service_order:service_orders(
            id,
            order_number,
            description,
            status,
            location:customer_locations!service_orders_customer_location_id_fkey(
              name,
              address,
              city,
              state,
              postcode,
              formatted_address
            )
          ),
          workers:appointment_workers(
            worker:profiles(first_name, last_name, email, phone)
          )
        `)
        .eq("id", appointmentId)
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

  if (!appointment) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Appointment not found</p>
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

  const duration = new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime();
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <CardHeader className="relative">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <Badge 
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border",
                  getStatusColor(appointment.status)
                )}
              >
                {formatStatus(appointment.status)}
              </Badge>
              {appointment.completion_reported_at && (
                <Badge className="rounded-full px-3 py-1 bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Work Completed
                </Badge>
              )}
            </div>
            <div>
              <CardTitle className="text-2xl md:text-3xl mb-2">{appointment.title}</CardTitle>
              {appointment.appointment_number && (
                <p className="text-sm text-muted-foreground">
                  Appointment #{appointment.appointment_number}
                </p>
              )}
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
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-semibold">
                  {new Date(appointment.start_time).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-info/10 p-2">
                <Clock className="h-4 w-4 text-info" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-semibold">
                  {new Date(appointment.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                  {' - '}
                  {new Date(appointment.end_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-warning/10 p-2">
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold">
                  {hours > 0 && `${hours}h `}{minutes}min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-success/10 p-2">
                <FileText className="h-4 w-4 text-success" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Service Order</p>
                <p className="text-sm font-semibold">
                  {appointment.service_order?.order_number || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {appointment.description && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{appointment.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Location */}
      {appointment.service_order?.location && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Location</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="font-semibold">{appointment.service_order.location.name}</p>
              {appointment.service_order.location.formatted_address ? (
                <p className="text-sm text-muted-foreground">
                  {appointment.service_order.location.formatted_address}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {appointment.service_order.location.address}
                  {appointment.service_order.location.city && `, ${appointment.service_order.location.city}`}
                  {appointment.service_order.location.state && ` ${appointment.service_order.location.state}`}
                  {appointment.service_order.location.postcode && ` ${appointment.service_order.location.postcode}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Workers */}
      {appointment.workers && appointment.workers.length > 0 && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Assigned Team</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointment.workers.map((w: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {w.worker.first_name} {w.worker.last_name}
                    </p>
                    {w.worker.email && (
                      <p className="text-xs text-muted-foreground">{w.worker.email}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Notes */}
      {appointment.completion_notes && (
        <Card className="border-border/40 bg-success/5 border-success/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <CardTitle className="text-lg">Completion Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {appointment.completion_notes}
            </p>
            {appointment.completion_reported_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Completed on {new Date(appointment.completion_reported_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {appointment.notes && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{appointment.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
