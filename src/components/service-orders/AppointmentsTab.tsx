import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, MoreVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";
import TimeLogsTable from "./TimeLogsTable";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

interface AppointmentsTabProps {
  serviceOrderId: string;
}

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-info/10 text-info",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  checked_in: "bg-warning/10 text-warning",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function AppointmentsTab({ serviceOrderId }: AppointmentsTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["service-order-appointments-v2", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          appointment_workers(
            worker_id,
            workers(
              id,
              first_name,
              last_name,
              pay_rate_category:pay_rate_categories(hourly_rate)
            )
          )
        `)
        .eq("service_order_id", serviceOrderId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      
      // Map data to include assigned_workers in expected format
      const appointmentsWithData = (data || []).map((apt: any) => ({
        ...apt,
        assigned_workers: apt.appointment_workers || []
      }));
      
      return appointmentsWithData;
    },
  });

  // Real-time subscription for appointments
  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `service_order_id=eq.${serviceOrderId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["service-order-appointments-v2", serviceOrderId] });
          queryClient.invalidateQueries({ queryKey: ["service-order", serviceOrderId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceOrderId, queryClient]);

  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: "draft" | "published" | "checked_in" | "completed" | "cancelled" }) => {
      // Update appointment status
      const { error: aptError } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId);
      
      if (aptError) throw aptError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-appointments-v2", serviceOrderId] });
      queryClient.invalidateQueries({ queryKey: ["service-order", serviceOrderId] });
      toast({ title: "Appointment status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating appointment", description: error.message, variant: "destructive" });
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
    <>
      <div className="space-y-4">
        {appointments.map((appointment: any) => (
          <Card 
            key={appointment.id} 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate(`/appointments/${appointment.id}`)}
          >
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
                    
                    <div className="space-y-3 text-sm">
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
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          {appointment.assigned_workers?.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {appointment.assigned_workers.map((aw: any) => (
                                aw.workers && (
                                  <Badge key={aw.worker_id} className="bg-primary text-primary-foreground font-medium">
                                    {aw.workers.first_name} {aw.workers.last_name}
                                  </Badge>
                                )
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No workers assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  
                  {appointment.description && (
                    <p className="text-sm text-muted-foreground">{appointment.description}</p>
                  )}
                  </div>
                  
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {appointment.status !== "published" && (
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => updateAppointmentStatusMutation.mutate({
                          appointmentId: appointment.id,
                          status: "published",
                        })}
                      >
                        Publish
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background z-50">
                        <DropdownMenuItem 
                          onClick={() => updateAppointmentStatusMutation.mutate({
                            appointmentId: appointment.id,
                            status: "draft",
                          })}
                        >
                          Set to Draft
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateAppointmentStatusMutation.mutate({
                            appointmentId: appointment.id,
                            status: "completed",
                          })}
                        >
                          Mark as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateAppointmentStatusMutation.mutate({
                            appointmentId: appointment.id,
                            status: "cancelled",
                          })}
                        >
                          Cancel Appointment
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async (e) => {
                            e.stopPropagation();
                            
                            // Check for time logs
                            const { data: timeLogs } = await supabase
                              .from("time_logs")
                              .select("id")
                              .eq("appointment_id", appointment.id)
                              .limit(1);
                            
                            // Check for field reports
                            const { data: fieldReports } = await supabase
                              .from("field_reports")
                              .select("id")
                              .eq("appointment_id", appointment.id)
                              .limit(1);
                            
                            if (timeLogs && timeLogs.length > 0) {
                              toast({
                                title: "Cannot delete appointment",
                                description: "This appointment has time logs recorded. Please delete the time logs first.",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            if (fieldReports && fieldReports.length > 0) {
                              toast({
                                title: "Cannot delete appointment",
                                description: "This appointment has field reports. Please delete the field reports first.",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            if (confirm("Are you sure you want to delete this appointment?")) {
                              const { error } = await supabase
                                .from("appointments")
                                .delete()
                                .eq("id", appointment.id);
                              
                              if (error) {
                                toast({
                                  title: "Error deleting appointment",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              } else {
                                toast({ title: "Appointment deleted successfully" });
                                queryClient.invalidateQueries({ queryKey: ["service-order-appointments-v2", serviceOrderId] });
                              }
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Appointment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
    </>
  );
}
