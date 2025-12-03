import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";
import AppointmentContextMenu from "./AppointmentContextMenu";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteAppointmentDialog } from "@/components/appointments/DeleteAppointmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import RecurringEditDialog from "./RecurringEditDialog";

interface SchedulerMonthViewProps {
  currentDate: Date;
  appointments: any[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment: (id: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string) => void;
  onGPSCheckIn: (appointment: any) => void;
}

const statusColors = {
  draft: "bg-muted",
  published: "bg-info",
  checked_in: "bg-warning",
  completed: "bg-success",
  cancelled: "bg-destructive",
};

export default function SchedulerMonthView({ 
  currentDate,
  appointments,
  onAppointmentClick,
  onEditAppointment,
  onRemoveWorker,
  onGPSCheckIn
}: SchedulerMonthViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<"single" | "series">("single");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    <div className="space-y-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map(day => {
          const dayAppointments = appointments.filter(apt =>
            isSameDay(new Date(apt.start_time), day)
          );
          
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <DroppableTimeSlot
              key={day.toISOString()}
              id={`month-slot-${day.toISOString()}`}
              date={day}
              workerId={null}
              className={cn(
                "min-h-[120px] p-2 border-2 rounded-lg",
                isCurrentMonth ? "border-border bg-background" : "border-border/50 bg-muted/30",
                isToday && "border-primary bg-primary/5"
              )}
            >
              {/* Date number */}
              <div className={cn(
                "text-sm font-semibold mb-2",
                isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                isToday && "text-primary"
              )}>
                {format(day, "d")}
              </div>

              {/* Appointments */}
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map(apt => {
                  const statusColor = apt.status === "draft" ? "gray" 
                    : apt.status === "published" ? "blue"
                    : apt.status === "checked_in" ? "yellow"
                    : apt.status === "completed" ? "green"
                    : apt.status === "cancelled" ? "red" : "gray";
                  
                  return (
                    <AppointmentContextMenu
                      key={apt.id}
                      appointment={apt}
                      onDelete={() => handleDeleteClick(apt)}
                    >
                      <DraggableAppointment
                        appointment={apt}
                        statusColor={statusColor}
                        onDelete={() => handleDeleteClick(apt)}
                        onViewHistory={() => onAppointmentClick(apt.id)}
                        showFullDetails={false}
                      />
                    </AppointmentContextMenu>
                  );
                })}
                {dayAppointments.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center pt-1">
                    +{dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </DroppableTimeSlot>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted"></div>
          <span className="text-xs">Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-info"></div>
          <span className="text-xs">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-warning"></div>
          <span className="text-xs">Checked In</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success"></div>
          <span className="text-xs">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive"></div>
          <span className="text-xs">Cancelled</span>
        </div>
      </div>

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
    </div>
  );
}
