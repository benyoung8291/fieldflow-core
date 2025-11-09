import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, MapPin, MoreVertical, Repeat } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";
import AppointmentContextMenu from "./AppointmentContextMenu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SchedulerWeekViewProps {
  currentDate: Date;
  appointments: any[];
  workers: any[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment: (id: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string) => void;
  onGPSCheckIn: (appointment: any) => void;
  checkAvailability?: (workerId: string, startTime: Date, endTime: Date) => { isAvailable: boolean; reason?: string };
}

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-info/10 text-info",
  checked_in: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function SchedulerWeekView({ 
  currentDate,
  appointments,
  workers: passedWorkers,
  onAppointmentClick,
  onEditAppointment,
  onRemoveWorker,
  onGPSCheckIn,
  checkAvailability
}: SchedulerWeekViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<any>(null);
  
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Format workers from passed list
  const formattedWorkers = passedWorkers.map(worker => ({
    id: worker.id,
    name: `${worker.first_name} ${worker.last_name}`
  }));

  // Add unassigned row
  const workers = [
    { id: null, name: "Unassigned" },
    ...formattedWorkers
  ];

  const handleGPSCheckIn = (appointment: any) => {
    setSelectedAppointment(appointment);
    setGpsDialogOpen(true);
  };

  const handleDeleteClick = (appointment: any) => {
    if (appointment.is_recurring || appointment.parent_appointment_id) {
      setAppointmentToDelete(appointment);
      setShowRecurringDeleteDialog(true);
    } else {
      handleDelete(appointment.id, "single");
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
          if (appointmentToDelete) {
            handleDelete(appointmentToDelete.id, type);
          }
          setShowRecurringDeleteDialog(false);
        }}
        action="delete"
      />
      
      <div className="space-y-4 overflow-x-auto">
        {/* Header with days */}
        <div className="grid grid-cols-[150px_repeat(7,1fr)] gap-2 min-w-[900px]">
          <div className="text-sm font-medium text-muted-foreground">Technician</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="text-center">
              <div className={cn(
                "text-sm font-medium",
                isSameDay(day, new Date()) && "text-primary"
              )}>
                {format(day, "EEE")}
              </div>
              <div className={cn(
                "text-lg font-bold",
                isSameDay(day, new Date()) && "text-primary"
              )}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Workers rows */}
        <div className="space-y-2 min-w-[900px]">
          {workers.map(worker => (
            <div key={worker.id || "unassigned"} className="grid grid-cols-[150px_repeat(7,1fr)] gap-2">
              {/* Worker name */}
              <div className="flex items-center px-3 py-2 bg-muted rounded-lg">
                <span className="text-sm font-medium truncate">{worker.name}</span>
              </div>

              {/* Day cells */}
              {weekDays.map(day => {
                const dayAppointments = appointments.filter(apt => {
                  const isUnassigned = !apt.assigned_to && (!apt.appointment_workers || apt.appointment_workers.length === 0);
                  const matchesWorker = worker.id === null ? isUnassigned : apt.assigned_to === worker.id;
                  return matchesWorker && isSameDay(new Date(apt.start_time), day);
                });

                // Check if worker is available for this day (using 9am-5pm as default check)
                const dayStart = new Date(day);
                dayStart.setHours(9, 0, 0, 0);
                const dayEnd = new Date(day);
                dayEnd.setHours(17, 0, 0, 0);
                
                const isAvailable = !worker.id || !checkAvailability 
                  ? true 
                  : checkAvailability(worker.id, dayStart, dayEnd).isAvailable;

                return (
                  <DroppableTimeSlot
                    key={day.toISOString()}
                    id={`slot-${worker.id || 'unassigned'}-${day.toISOString()}`}
                    date={day}
                    workerId={worker.id}
                    isAvailable={isAvailable}
                    className={cn(
                      "min-h-[100px] p-2 border-2 border-dashed rounded-lg space-y-1",
                      isSameDay(day, new Date()) 
                        ? "border-primary/30 bg-primary/5" 
                        : "border-border bg-muted/20"
                    )}
                  >
                    {dayAppointments.map(apt => (
                      <AppointmentContextMenu
                        key={apt.id}
                        appointment={apt}
                        onEdit={() => onEditAppointment(apt.id)}
                        onRemoveWorker={(workerId) => onRemoveWorker(apt.id, workerId)}
                        onDelete={!apt.assigned_to ? () => handleDeleteClick(apt) : undefined}
                        onGPSCheckIn={() => onGPSCheckIn(apt)}
                        onViewDetails={() => onAppointmentClick(apt.id)}
                      >
                        <DraggableAppointment
                          appointment={apt}
                          statusColor={statusColors[apt.status as keyof typeof statusColors]}
                          onEdit={() => onEditAppointment(apt.id)}
                          onGPSCheckIn={() => onGPSCheckIn(apt)}
                          onViewHistory={() => onAppointmentClick(apt.id)}
                          onDelete={!apt.assigned_to ? () => handleDeleteClick(apt) : undefined}
                        />
                      </AppointmentContextMenu>
                    ))}
                    {dayAppointments.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        Drop here
                      </div>
                    )}
                  </DroppableTimeSlot>
                );
              })}
            </div>
          ))}
        </div>

        {workers.length === 1 && (
          <div className="text-center py-8 text-muted-foreground">
            No technicians assigned to appointments this week
          </div>
        )}
      </div>
    </>
  );
}