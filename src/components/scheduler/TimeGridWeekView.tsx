import { format, startOfWeek, endOfWeek, eachDayOfInterval, setHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";

interface TimeGridWeekViewProps {
  currentDate: Date;
  appointments: any[];
  workers: any[];
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

  // Format workers with unassigned row
  const workers = [
    { id: null, name: "Unassigned", skills: [] },
    ...passedWorkers.map(w => ({
      id: w.id,
      name: `${w.first_name} ${w.last_name}`,
      skills: w.worker_skills || []
    }))
  ];

  const getAppointmentsForDayAndWorker = (workerId: string | null, day: Date) => {
    const filtered = appointments.filter(apt => {
      const aptDate = format(new Date(apt.start_time), "yyyy-MM-dd");
      const dayDate = format(day, "yyyy-MM-dd");
      const aptWorkerId = apt.assigned_to || null;
      return aptDate === dayDate && aptWorkerId === workerId;
    });
    console.log(`Appointments for worker ${workerId} on ${format(day, "yyyy-MM-dd")}:`, filtered.length);
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
            {workers.map((worker) => (
              <div key={worker.id || 'unassigned'} className="grid grid-cols-8 gap-px bg-border mb-px">
                {/* Worker Info */}
                <div className="sticky left-0 z-10 bg-background flex flex-col items-start p-2 gap-1">
                  <span className="text-sm font-medium truncate w-full">{worker.name}</span>
                  {worker.skills && worker.skills.length > 0 && (
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
                  const dayAppointments = getAppointmentsForDayAndWorker(worker.id, day);
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className="relative bg-background"
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
