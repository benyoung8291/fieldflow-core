import { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, MapPin, MoreVertical, Repeat, Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import GPSCheckInDialog from "./GPSCheckInDialog";
import RecurringEditDialog from "./RecurringEditDialog";
import { DeleteAppointmentDialog } from "@/components/appointments/DeleteAppointmentDialog";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import { SubcontractorWorker } from "@/hooks/useSubcontractorWorkers";

interface SchedulerWeekViewProps {
  currentDate: Date;
  appointments: any[];
  workers: any[];
  subcontractors?: SubcontractorWorker[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment: (id: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string | null, contactId: string | null) => void;
  onGPSCheckIn: (appointment: any) => void;
  checkAvailability?: (workerId: string, startTime: Date, endTime: Date) => { isAvailable: boolean; reason?: string; availablePeriods?: string[] };
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
  subcontractors = [],
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
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<"single" | "series">("single");
  
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch worker schedules and unavailability for sorting
  const { data: schedules = [] } = useQuery({
    queryKey: ["worker-schedules-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_schedule")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: unavailability = [] } = useQuery({
    queryKey: ["worker-unavailability-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_unavailability")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // Format workers with unassigned row
  const formattedWorkers = passedWorkers.map(w => ({
    id: w.id,
    name: `${w.first_name} ${w.last_name}`,
    skills: w.worker_skills || [],
    standard_work_hours: w.standard_work_hours,
    employment_type: w.employment_type,
    isSubcontractor: false,
  }));

  // Format subcontractors
  const formattedSubcontractors = subcontractors.map(s => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    companyName: s.supplier_name,
    workerState: s.worker_state,
    skills: [],
    standard_work_hours: 0,
    employment_type: null,
    isSubcontractor: true,
  }));

  // Calculate availability status for workers
  const getWorkerAvailabilityStatus = (workerId: string): "available" | "partial" | "unavailable" => {
    const workerSchedule = schedules.filter(s => s.worker_id === workerId);
    const workerUnavail = unavailability.filter(u => {
      const unavailStart = new Date(u.start_date);
      const unavailEnd = new Date(u.end_date);
      return (
        (unavailStart <= weekEnd && unavailEnd >= weekStart)
      );
    });

    let scheduledDays = 0;
    let unavailableDays = 0;

    for (const day of weekDays) {
      const dayOfWeek = day.getDay();
      const hasSchedule = workerSchedule.some(s => s.day_of_week === dayOfWeek);
      
      if (hasSchedule) {
        scheduledDays++;
        const isUnavailable = workerUnavail.some(u => {
          const unavailStart = new Date(u.start_date);
          const unavailEnd = new Date(u.end_date);
          return day >= unavailStart && day <= unavailEnd;
        });
        if (isUnavailable) unavailableDays++;
      }
    }

    if (scheduledDays === 0) return "unavailable";
    if (unavailableDays === scheduledDays) return "unavailable";
    if (unavailableDays > 0) return "partial";
    return "available";
  };

  // Sort workers: available first, then partial, then unavailable
  const sortedWorkers = [...formattedWorkers].sort((a, b) => {
    const statusOrder = { available: 0, partial: 1, unavailable: 2 };
    const statusA = getWorkerAvailabilityStatus(a.id);
    const statusB = getWorkerAvailabilityStatus(b.id);
    return statusOrder[statusA] - statusOrder[statusB];
  });

  // Combine: Unassigned, sorted workers, then subcontractors at the bottom
  const workers = [
    { id: null, name: "Unassigned", skills: [], standard_work_hours: 0, employment_type: null, isSubcontractor: false },
    ...sortedWorkers,
    ...formattedSubcontractors
  ];

  // Calculate utilization for internal workers only
  const workerUtilization = useWorkerUtilization(formattedWorkers, appointments, currentDate);

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

  // Helper function to check if an appointment matches a worker/subcontractor
  const appointmentMatchesWorker = (apt: any, workerId: string | null, isSubcontractor: boolean) => {
    const hasNoWorkers = !apt.appointment_workers || apt.appointment_workers.length === 0;
    
    if (workerId === null) {
      return hasNoWorkers;
    }

    if (isSubcontractor) {
      // Match by contact_id for subcontractors
      return apt.appointment_workers?.some((aw: any) => aw.contact_id === workerId);
    } else {
      // Match by worker_id for internal workers
      return apt.appointment_workers?.some((aw: any) => aw.worker_id === workerId);
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
          {workers.map((worker: any, index) => {
            const utilization = worker.id && !worker.isSubcontractor 
              ? workerUtilization.find(u => u.workerId === worker.id) 
              : null;
            const availabilityStatus = worker.id && !worker.isSubcontractor 
              ? getWorkerAvailabilityStatus(worker.id) 
              : "available";
            
            return (
              <div 
                key={worker.id || "unassigned"} 
                className={cn(
                  "grid gap-2",
                  worker.isSubcontractor && "bg-violet-50/50 dark:bg-violet-950/20 rounded-lg"
                )} 
                style={{ gridTemplateColumns: '150px repeat(7, minmax(140px, 1fr))' }}
              >
                {/* Worker name with utilization */}
                <div className={cn(
                  "flex flex-col items-start px-3 py-2 rounded-lg gap-1",
                  worker.isSubcontractor 
                    ? "bg-violet-100 dark:bg-violet-900/30" 
                    : availabilityStatus === "unavailable" 
                      ? "bg-muted/50 opacity-60" 
                      : "bg-muted"
                )}>
                  <div className="flex items-center gap-1.5 w-full">
                    {worker.isSubcontractor && (
                      <Briefcase className="h-3 w-3 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm font-medium truncate",
                      worker.isSubcontractor && "text-violet-700 dark:text-violet-300"
                    )}>
                      {worker.name}
                    </span>
                  </div>
                  
                  {/* Company name for subcontractors */}
                  {worker.isSubcontractor && worker.companyName && (
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 truncate w-full">
                      {worker.companyName}
                    </span>
                  )}

                  {/* State badge for subcontractors */}
                  {worker.isSubcontractor && worker.workerState && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-violet-200/50 dark:bg-violet-800/50 border-violet-300 dark:border-violet-600">
                      {worker.workerState}
                    </Badge>
                  )}

                  {/* Availability status for unavailable workers */}
                  {!worker.isSubcontractor && availabilityStatus === "unavailable" && worker.id && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted border-muted-foreground/30">
                      Unavailable
                    </Badge>
                  )}
                  
                  {/* Worker skills */}
                  {worker.skills && worker.skills.length > 0 && !worker.isSubcontractor && (
                    <div className="flex flex-wrap gap-1 w-full">
                      {worker.skills.map((ws: any) => (
                        <Badge key={ws.skill_id} variant="outline" className="text-[10px] px-1 py-0">
                          {ws.skills?.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Utilization bar - only for internal workers */}
                  {utilization && utilization.standardHours > 0 && !worker.isSubcontractor && (
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
                  const matchesWorker = appointmentMatchesWorker(apt, worker.id, worker.isSubcontractor);
                  return matchesWorker && isSameDay(new Date(apt.start_time), day);
                });

                // Check if worker is available for this day (using 9am-5pm as default check)
                const dayStart = new Date(day);
                dayStart.setHours(9, 0, 0, 0);
                const dayEnd = new Date(day);
                dayEnd.setHours(17, 0, 0, 0);
                
                const availabilityInfo = !worker.id || !checkAvailability || worker.isSubcontractor
                  ? { isAvailable: true } 
                  : checkAvailability(worker.id, dayStart, dayEnd);

                return (
                  <DroppableTimeSlot
                    key={day.toISOString()}
                    id={`slot-${worker.id || 'unassigned'}-${day.toISOString()}`}
                    date={day}
                    workerId={worker.id}
                    isAvailable={availabilityInfo.isAvailable}
                    className={cn(
                      "min-h-[150px] h-full p-2 border-2 border-dashed rounded-lg space-y-1 flex flex-col",
                      isSameDay(day, new Date()) 
                        ? "border-primary/30 bg-primary/5" 
                        : worker.isSubcontractor
                          ? "border-violet-300/30 dark:border-violet-700/30 bg-violet-50/30 dark:bg-violet-950/10"
                          : "border-border bg-muted/20",
                      !availabilityInfo.isAvailable && "opacity-50"
                    )}
                  >
                    {availabilityInfo.availablePeriods && availabilityInfo.availablePeriods.length > 0 && !availabilityInfo.availablePeriods.includes('anytime') && (
                      <div className="text-xs text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded mb-1">
                        {availabilityInfo.availablePeriods.map(p => {
                          const emoji: Record<string, string> = { morning: '🌅', afternoon: '☀️', evening: '🌙' };
                          return emoji[p] || '';
                        }).join(' ')}
                      </div>
                    )}
                    {dayAppointments.map(apt => (
                      <AppointmentContextMenu
                        key={apt.id}
                        appointment={apt}
                        onDelete={() => handleDeleteClick(apt)}
                      >
                        <DraggableAppointment
                          appointment={apt}
                          statusColor={statusColors[apt.status as keyof typeof statusColors]}
                          onViewHistory={() => onAppointmentClick(apt.id)}
                          onDelete={() => handleDeleteClick(apt)}
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
