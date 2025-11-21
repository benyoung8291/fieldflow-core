import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, MoreVertical, Edit } from "lucide-react";
import { format } from "date-fns";
import TimeLogsTable from "./TimeLogsTable";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AppointmentDialog from "@/components/scheduler/AppointmentDialog";
import { useState } from "react";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["service-order-appointments", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      
      // Fetch assigned profiles and workers separately
      const appointmentsWithData = await Promise.all(
        (data || []).map(async (apt: any) => {
          // Get primary assigned user
          let assigned_to_profile = null;
          if (apt.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name, email")
              .eq("id", apt.assigned_to)
              .maybeSingle();
            assigned_to_profile = profile;
          }
          
          // Get all assigned workers
          const { data: workers } = await supabase
            .from("appointment_workers")
            .select("worker_id, profiles(first_name, last_name)")
            .eq("appointment_id", apt.id);
          
          return { 
            ...apt, 
            assigned_to_profile,
            assigned_workers: workers || []
          };
        })
      );
      
      return appointmentsWithData;
    },
  });

  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: "draft" | "published" | "checked_in" | "completed" | "cancelled" }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-appointments", serviceOrderId] });
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
                  </div>
                  
                  {appointment.assigned_workers?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {appointment.assigned_workers.map((aw: any) => (
                        aw.profiles && (
                          <Badge key={aw.worker_id} variant="secondary" className="text-xs">
                            {aw.profiles.first_name} {aw.profiles.last_name}
                          </Badge>
                        )
                      ))}
                    </div>
                  )}
                  
                  {appointment.description && (
                    <p className="text-sm text-muted-foreground">{appointment.description}</p>
                  )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingAppointmentId(appointment.id);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
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

      <AppointmentDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingAppointmentId(null);
            queryClient.invalidateQueries({ queryKey: ["service-order-appointments", serviceOrderId] });
          }
        }}
        appointmentId={editingAppointmentId || undefined}
        defaultServiceOrderId={serviceOrderId}
      />
    </>
  );
}
