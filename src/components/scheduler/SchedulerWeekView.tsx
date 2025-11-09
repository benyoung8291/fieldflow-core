import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, MapPin, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import GPSCheckInDialog from "./GPSCheckInDialog";
import { useQueryClient } from "@tanstack/react-query";

interface SchedulerWeekViewProps {
  currentDate: Date;
  appointments: any[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment: (id: string) => void;
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
  onAppointmentClick,
  onEditAppointment
}: SchedulerWeekViewProps) {
  const queryClient = useQueryClient();
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Get unique technicians from appointments
  const technicians = Array.from(
    new Map(
      appointments
        .filter(apt => apt.assigned_to && apt.profiles)
        .map(apt => [
          apt.assigned_to, 
          {
            id: apt.assigned_to,
            name: `${apt.profiles.first_name} ${apt.profiles.last_name}`
          }
        ])
    ).values()
  );

  // Add unassigned row
  const workers = [
    { id: null, name: "Unassigned" },
    ...technicians
  ];

  const handleGPSCheckIn = (appointment: any) => {
    setSelectedAppointment(appointment);
    setGpsDialogOpen(true);
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
                const dayAppointments = appointments.filter(
                  apt => apt.assigned_to === worker.id && 
                         isSameDay(new Date(apt.start_time), day)
                );

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[100px] p-2 border-2 border-dashed rounded-lg space-y-1",
                      isSameDay(day, new Date()) 
                        ? "border-primary/30 bg-primary/5" 
                        : "border-border bg-muted/20"
                    )}
                  >
                    {dayAppointments.map(apt => (
                      <div
                        key={apt.id}
                        className={cn(
                          "p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow group relative",
                          statusColors[apt.status as keyof typeof statusColors]
                        )}
                        onClick={() => onAppointmentClick(apt.id)}
                      >
                        <div className="font-medium truncate">{apt.title}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(apt.start_time), "HH:mm")}</span>
                        </div>
                        {apt.location_address && (
                          <div className="flex items-center gap-1 mt-1 text-[10px]">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{apt.location_address.split(',')[0]}</span>
                          </div>
                        )}
                        
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onEditAppointment(apt.id);
                              }}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleGPSCheckIn(apt);
                              }}>
                                {apt.check_in_time ? "Check Out" : "GPS Check In"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick(apt.id);
                              }}>
                                View History
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                    {dayAppointments.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No appointments
                      </div>
                    )}
                  </div>
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