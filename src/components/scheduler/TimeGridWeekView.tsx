import { format, startOfWeek, endOfWeek, eachDayOfInterval, setHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase } from "lucide-react";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";
import { SubcontractorWorker } from "@/hooks/useSubcontractorWorkers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimeGridWeekViewProps {
  currentDate: Date;
  appointments: any[];
  workers: any[];
  subcontractors?: SubcontractorWorker[];
  onAppointmentClick: (id: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string) => void;
  onResizeAppointment: (appointmentId: string, newStartTime: Date, newEndTime: Date) => void;
  onCreateAppointment: (workerId: string | null, date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const PIXELS_PER_HOUR = 25; // 25px per hour for very compact view

export default function TimeGridWeekView({
  currentDate,
  appointments,
  workers: passedWorkers,
  subcontractors = [],
  onAppointmentClick,
  onRemoveWorker,
  onResizeAppointment,
  onCreateAppointment,
}: TimeGridWeekViewProps) {
  console.log('TimeGridWeekView - Total appointments:', appointments.length);
  console.log('TimeGridWeekView - Appointments:', appointments);
  
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

  // Calculate availability status for workers
  const getWorkerAvailabilityStatus = (workerId: string): "available" | "partial" | "unavailable" => {
    const workerSchedule = schedules.filter(s => s.worker_id === workerId);
    const workerUnavail = unavailability.filter(u => {
      const unavailStart = new Date(u.start_date);
      const unavailEnd = new Date(u.end_date);
      return unavailStart <= weekEnd && unavailEnd >= weekStart;
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

  // Format and sort internal workers
  const formattedWorkers = passedWorkers.map(w => ({
    id: w.id,
    name: `${w.first_name} ${w.last_name}`,
    skills: w.worker_skills || [],
    isSubcontractor: false,
  }));

  const sortedWorkers = [...formattedWorkers].sort((a, b) => {
    const statusOrder = { available: 0, partial: 1, unavailable: 2 };
    const statusA = getWorkerAvailabilityStatus(a.id);
    const statusB = getWorkerAvailabilityStatus(b.id);
    return statusOrder[statusA] - statusOrder[statusB];
  });

  // Format subcontractors
  const formattedSubcontractors = subcontractors.map(s => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    companyName: s.supplier_name,
    workerState: s.worker_state,
    skills: [],
    isSubcontractor: true,
  }));

  // Combine: Unassigned, sorted workers, then subcontractors
  const workers = [
    { id: null, name: "Unassigned", skills: [], isSubcontractor: false },
    ...sortedWorkers,
    ...formattedSubcontractors
  ];

  // Helper to check if appointment matches worker/subcontractor
  const appointmentMatchesWorker = (apt: any, workerId: string | null, isSubcontractor: boolean) => {
    if (workerId === null) {
      return !apt.appointment_workers || apt.appointment_workers.length === 0;
    }

    if (isSubcontractor) {
      return apt.appointment_workers?.some((aw: any) => aw.contact_id === workerId);
    } else {
      return apt.appointment_workers?.some((aw: any) => aw.worker_id === workerId);
    }
  };

  const getAppointmentsForDayAndWorker = (worker: any, day: Date) => {
    const filtered = appointments.filter(apt => {
      const aptDate = format(new Date(apt.start_time), "yyyy-MM-dd");
      const dayDate = format(day, "yyyy-MM-dd");
      const matchesWorker = appointmentMatchesWorker(apt, worker.id, worker.isSubcontractor);
      return aptDate === dayDate && matchesWorker;
    });
    return filtered;
  };

  const getTopPosition = (time: Date) => {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    return (hours + minutes / 60) * PIXELS_PER_HOUR;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Row - Days */}
      <div className="grid grid-cols-8 gap-px bg-border flex-shrink-0 bg-background z-20 pb-px border-b">
        <div className="font-semibold text-sm p-2 bg-background">Worker</div>
        {weekDays.map(day => (
          <div key={day.toISOString()} className="text-center font-semibold text-sm p-2 bg-background">
            <div>{format(day, "EEE")}</div>
            <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto relative bg-border">
        <div className="relative">
          {/* Time labels column */}
          <div className="absolute left-0 top-0 w-12 z-10 bg-border">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="text-[9px] text-muted-foreground text-right pr-1 bg-background mb-px flex items-center justify-end"
                style={{ height: `${PIXELS_PER_HOUR}px` }}
              >
                {hour}h
              </div>
            ))}
          </div>

          {/* Worker Rows */}
          <div className="pl-12">
            {workers.map((worker: any) => {
              const availabilityStatus = worker.id && !worker.isSubcontractor 
                ? getWorkerAvailabilityStatus(worker.id) 
                : "available";

              return (
                <div 
                  key={worker.id || 'unassigned'} 
                  className={cn(
                    "grid grid-cols-8 gap-px bg-border mb-px",
                    worker.isSubcontractor && "bg-violet-100/50 dark:bg-violet-950/30"
                  )}
                >
                  {/* Worker Info */}
                  <div className={cn(
                    "sticky left-0 z-10 flex flex-col items-start p-2 gap-1",
                    worker.isSubcontractor 
                      ? "bg-violet-100 dark:bg-violet-900/40" 
                      : availabilityStatus === "unavailable"
                        ? "bg-muted/50 opacity-60"
                        : "bg-background"
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
                    {worker.isSubcontractor && worker.companyName && (
                      <span className="text-[10px] text-violet-600 dark:text-violet-400 truncate w-full">
                        {worker.companyName}
                      </span>
                    )}
                    {worker.isSubcontractor && worker.workerState && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-violet-200/50 dark:bg-violet-800/50 border-violet-300 dark:border-violet-600">
                        {worker.workerState}
                      </Badge>
                    )}
                    {!worker.isSubcontractor && availabilityStatus === "unavailable" && worker.id && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted border-muted-foreground/30">
                        Unavailable
                      </Badge>
                    )}
                    {worker.skills && worker.skills.length > 0 && !worker.isSubcontractor && (
                      <div className="flex flex-wrap gap-1 w-full">
                        {worker.skills.map((ws: any) => (
                          <Badge key={ws.skill_id} variant="outline" className="text-[10px] px-1 py-0">
                            {ws.skills?.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time grid for each day */}
                  {weekDays.map((day) => {
                    const dayAppointments = getAppointmentsForDayAndWorker(worker, day);
                    
                    return (
                      <div 
                        key={day.toISOString()} 
                        className={cn(
                          "relative",
                          worker.isSubcontractor 
                            ? "bg-violet-50/50 dark:bg-violet-950/20" 
                            : "bg-background"
                        )}
                        style={{ minHeight: `${HOURS.length * PIXELS_PER_HOUR}px` }}
                      >
                        {/* Hour grid lines */}
                        {HOURS.map(hour => (
                          <DroppableTimeSlot
                            key={hour}
                            id={`timeslot-${worker.id || 'unassigned'}-${format(day, 'yyyy-MM-dd')}-${hour}`}
                            date={day}
                            workerId={worker.id}
                            hour={hour}
                            className="border-b border-border/20 group relative"
                          >
                            <div style={{ height: `${PIXELS_PER_HOUR}px` }}>
                              {/* Add appointment button on hover */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity h-full flex items-center justify-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onCreateAppointment(worker.id, day, hour)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </DroppableTimeSlot>
                        ))}

                        {/* Appointments positioned absolutely */}
                        {dayAppointments.map(apt => {
                          const top = getTopPosition(new Date(apt.start_time));
                          const durationHours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
                          const height = durationHours * PIXELS_PER_HOUR;
                          
                          const statusColor = apt.status === 'completed' ? 'bg-success' :
                            apt.status === 'checked_in' ? 'bg-warning' :
                            apt.status === 'cancelled' ? 'bg-destructive' :
                            apt.status === 'published' ? 'bg-info' : 'bg-muted';
                          
                          return (
                            <div
                              key={apt.id}
                              className="absolute left-0.5 right-0.5 z-10"
                              style={{ top: `${top}px`, height: `${height}px` }}
                            >
                              <DraggableAppointment
                                appointment={apt}
                                statusColor={statusColor}
                                onViewHistory={() => onAppointmentClick(apt.id)}
                                showFullDetails={true}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
