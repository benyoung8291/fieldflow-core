import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, MapPin, User, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import GPSCheckInDialog from "./GPSCheckInDialog";
import RecurringEditDialog from "./RecurringEditDialog";
import { DeleteAppointmentDialog } from "@/components/appointments/DeleteAppointmentDialog";
import { useQueryClient } from "@tanstack/react-query";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SchedulerDayViewProps {
  currentDate: Date;
  appointments: any[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment: (id: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string | null, contactId: string | null) => void;
  onGPSCheckIn: (appointment: any) => void;
}

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-info/10 text-info",
  checked_in: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const hours = Array.from({ length: 24 }, (_, i) => i);

export default function SchedulerDayView({ 
  currentDate,
  appointments,
  onAppointmentClick,
  onEditAppointment,
  onRemoveWorker,
  onGPSCheckIn
}: SchedulerDayViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<"single" | "series">("single");

  const todayAppointments = appointments.filter(apt =>
    isSameDay(new Date(apt.start_time), currentDate)
  ).sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const handleGPSCheckIn = (appointment: any) => {
    setSelectedAppointment(appointment);
    setGpsDialogOpen(true);
  };

  const handleDeleteClick = (appointment: any) => {
    setAppointmentToDelete(appointment);
    if (appointment.is_recurring || appointment.parent_appointment_id) {
      setShowRecurringDeleteDialog(true);
    } else {
      setDeleteType("single");
      setShowDeleteConfirmDialog(true);
    }
  };

  const handleDelete = async (appointmentId: string, deleteType: "single" | "series") => {
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
      
      if (deleteType === "series" && (appointment?.is_recurring || appointment?.parent_appointment_id)) {
        const targetId = appointment.parent_appointment_id || appointmentId;
        const { error } = await supabase
          .from("appointments")
          .delete()
          .or(`id.eq.${targetId},parent_appointment_id.eq.${targetId}`)
          .gte("start_time", appointment.start_time);

        if (error) throw error;
        toast({ title: "Recurring series deleted successfully" });
      } else {
        const { error } = await supabase
          .from("appointments")
          .delete()
          .eq("id", appointmentId);

        if (error) throw error;
        toast({ title: "Appointment deleted successfully" });
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (error: any) {
      toast({
        title: "Error deleting appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {selectedAppointment && (
        <GPSCheckInDialog
          open={gpsDialogOpen}
          onOpenChange={setGpsDialogOpen}
          appointment={selectedAppointment}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
          }}
        />
      )}

      <RecurringEditDialog
        open={showRecurringDeleteDialog}
        onOpenChange={setShowRecurringDeleteDialog}
        onConfirm={(type) => {
          setDeleteType(type);
          setShowRecurringDeleteDialog(false);
          setShowDeleteConfirmDialog(true);
        }}
        action="delete"
      />

      <DeleteAppointmentDialog
        open={showDeleteConfirmDialog}
        onOpenChange={setShowDeleteConfirmDialog}
        onConfirm={() => {
          if (appointmentToDelete) {
            handleDelete(appointmentToDelete.id, deleteType);
          }
        }}
        appointmentTitle={appointmentToDelete?.title || "this appointment"}
      />
      
      <div className="space-y-4">
        {/* Timeline view */}
        <div className="border border-border rounded-lg overflow-hidden">
          {hours.map(hour => {
            const hourAppointments = todayAppointments.filter(apt => {
              const startHour = new Date(apt.start_time).getHours();
              return startHour === hour;
            });

            return (
              <div 
                key={hour} 
                className="grid grid-cols-[80px_1fr] border-b border-border last:border-b-0"
              >
                {/* Time label */}
                <div className="p-3 bg-muted/50 border-r border-border">
                  <span className="text-sm font-medium">
                    {format(new Date().setHours(hour, 0), "HH:mm")}
                  </span>
                </div>

                {/* Appointments in this hour */}
                <DroppableTimeSlot
                  id={`slot-day-${hour}`}
                  date={currentDate}
                  workerId={null}
                  hour={hour}
                  className="p-2 min-h-[60px] space-y-2"
                >
                  {hourAppointments.map(apt => (
                    <DraggableAppointment
                      key={apt.id}
                      appointment={apt}
                      statusColor={statusColors[apt.status as keyof typeof statusColors]}
                      onViewHistory={() => onAppointmentClick(apt.id)}
                      onDelete={() => handleDeleteClick(apt)}
                      showFullDetails
                    />
                  ))}
                </DroppableTimeSlot>
              </div>
            );
          })}
        </div>

        {todayAppointments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No appointments scheduled for this day
          </div>
        )}
      </div>
    </>
  );
}
