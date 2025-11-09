import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import TimeLogsTable from "./TimeLogsTable";

interface AppointmentsTabProps {
  serviceOrderId: string;
}

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

export default function AppointmentsTab({ serviceOrderId }: AppointmentsTabProps) {
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["service-order-appointments", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      
      // Fetch assigned profiles separately
      const appointmentsWithProfiles = await Promise.all(
        (data || []).map(async (apt: any) => {
          if (!apt.assigned_to) return { ...apt, assigned_to_profile: null };
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("id", apt.assigned_to)
            .maybeSingle();
          
          return { ...apt, assigned_to_profile: profile };
        })
      );
      
      return appointmentsWithProfiles;
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Loading appointments...</div>;
  }

  if (appointments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No appointments scheduled for this service order
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment: any) => (
        <Card key={appointment.id}>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Appointment Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{appointment.title}</h3>
                    <Badge 
                      variant="outline" 
                      className={statusColors[appointment.status as keyof typeof statusColors]}
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(appointment.start_time), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(appointment.start_time), "h:mm a")} - {format(new Date(appointment.end_time), "h:mm a")}
                      </span>
                    </div>
                    {appointment.assigned_to_profile && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{appointment.assigned_to_profile.first_name} {appointment.assigned_to_profile.last_name}</span>
                      </div>
                    )}
                  </div>
                  
                  {appointment.description && (
                    <p className="text-sm text-muted-foreground">{appointment.description}</p>
                  )}
                </div>
              </div>

              {/* Time Logs for this Appointment */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3">Time Logs</h4>
                <TimeLogsTable appointmentId={appointment.id} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
