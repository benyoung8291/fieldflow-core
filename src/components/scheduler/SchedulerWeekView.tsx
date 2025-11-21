import { useState } from "react";
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
import GPSCheckInDialog from "./GPSCheckInDialog";
import RecurringEditDialog from "./RecurringEditDialog";
import { useQueryClient } from "@tanstack/react-query";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";
import AppointmentContextMenu from "./AppointmentContextMenu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkerUtilization } from "@/hooks/useWorkerUtilization";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  // Format workers with unassigned row
  const formattedWorkers = passedWorkers.map(w => ({
    id: w.id,
    name: `${w.first_name} ${w.last_name}`,
    skills: w.worker_skills || [],
    standard_work_hours: w.standard_work_hours,
    employment_type: w.employment_type,
  }));

  const workers = [
    { id: null, name: "Unassigned", skills: [], standard_work_hours: 0, employment_type: null },
    ...formattedWorkers
  ];

  // Calculate utilization for all workers
  const workerUtilization = useWorkerUtilization(formattedWorkers, appointments, currentDate);

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
        <div className="grid gap-2 min-w-[900px]" style={{ gridTemplateColumns: '150px repeat(7, minmax(140px, 1fr))' }}>
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
          {workers.map((worker, index) => {
            const utilization = worker.id ? workerUtilization.find(u => u.workerId === worker.id) : null;
            
            return (
              <div key={worker.id || "unassigned"} className="grid gap-2" style={{ gridTemplateColumns: '150px repeat(7, minmax(140px, 1fr))' }}>
                {/* Worker name with utilization */}
                <div className="flex flex-col items-start px-3 py-2 bg-muted rounded-lg gap-1">
                  <span className="text-sm font-medium truncate w-full">{worker.name}</span>
                  
                  {/* Worker skills */}
                  {worker.skills && worker.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 w-full">
                      {worker.skills.map((ws: any) => (
                        <Badge key={ws.skill_id} variant="outline" className="text-[10px] px-1 py-0">
                          {ws.skills?.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Utilization bar */}
                  {utilization && utilization.standardHours > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full space-y-0.5">
                            <div className="flex items-center justify-between text-[9px]">
                              <span className={cn("font-medium", utilization.utilizationColor)}>
                                {utilization.utilization}%
                              </span>
                              <span className="text-muted-foreground">
                                {utilization.scheduledHours}h / {utilization.standardHours}h
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(utilization.utilization, 100)} 
                              className={cn("h-1.5", "[&>div]:"+utilization.utilizationBgColor)}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="text-xs space-y-1">
                            <p className="font-semibold">Weekly Utilization</p>
                            <p>Scheduled: {utilization.scheduledHours}h</p>
                            <p>Standard: {utilization.standardHours}h</p>
                            <p className={cn("font-medium", utilization.utilizationColor)}>
                              {utilization.utilization}% utilized
                            </p>
                            {utilization.isOverbooked && (
                              <p className="text-destructive font-medium">⚠️ Overbooked</p>
                            )}
                            {utilization.isUnderUtilized && (
                              <p className="text-warning font-medium">Under-utilized</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

              {/* Day cells */}
              {weekDays.map(day => {
                const dayAppointments = appointments.filter(apt => {
                  const isUnassigned = !apt.appointment_workers || apt.appointment_workers.length === 0;
                  const hasWorkerAssigned = apt.appointment_workers?.some((aw: any) => aw.worker_id === worker.id);
                  const matchesWorker = worker.id === null 
                    ? isUnassigned 
                    : hasWorkerAssigned;
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
                      "min-h-[150px] h-full p-2 border-2 border-dashed rounded-lg space-y-1 flex flex-col",
                      isSameDay(day, new Date()) 
                        ? "border-primary/30 bg-primary/5" 
                        : "border-border bg-muted/20"
                    )}
                  >
                    {dayAppointments.map(apt => (
                      <AppointmentContextMenu
                        key={apt.id}
                        appointment={apt}
                        onDelete={!apt.assigned_to ? () => handleDeleteClick(apt) : undefined}
                      >
                        <DraggableAppointment
                          appointment={apt}
                          statusColor={statusColors[apt.status as keyof typeof statusColors]}
                          onViewHistory={() => onAppointmentClick(apt.id)}
                          onDelete={!apt.assigned_to ? () => handleDeleteClick(apt) : undefined}
                        />
                      </AppointmentContextMenu>
                    ))}
                    {dayAppointments.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center flex-1 flex items-center justify-center">
                        Drop here
                      </div>
                    )}
                  </DroppableTimeSlot>
                );
              })}
            </div>
          );
          })}
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