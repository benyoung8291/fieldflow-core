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
import { useQueryClient } from "@tanstack/react-query";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DraggableAppointment from "./DraggableAppointment";

interface SchedulerDayViewProps {
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

const hours = Array.from({ length: 24 }, (_, i) => i);

export default function SchedulerDayView({ 
  currentDate,
  appointments,
  onAppointmentClick,
  onEditAppointment
}: SchedulerDayViewProps) {
  const queryClient = useQueryClient();
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const todayAppointments = appointments.filter(apt =>
    isSameDay(new Date(apt.start_time), currentDate)
  ).sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

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
                      onEdit={() => onEditAppointment(apt.id)}
                      onGPSCheckIn={() => handleGPSCheckIn(apt)}
                      onViewHistory={() => onAppointmentClick(apt.id)}
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
