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
                <div className="p-2 min-h-[60px] space-y-2">
                  {hourAppointments.map(apt => (
                    <div
                      key={apt.id}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer hover:shadow-md transition-shadow group relative",
                        statusColors[apt.status as keyof typeof statusColors]
                      )}
                      onClick={() => onAppointmentClick(apt.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{apt.title}</h4>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(apt.start_time), "HH:mm")} - 
                              {format(new Date(apt.end_time), "HH:mm")}
                            </span>
                            {apt.profiles && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {apt.profiles.first_name} {apt.profiles.last_name}
                              </span>
                            )}
                            {apt.location_address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {apt.location_address.split(',')[0]}
                              </span>
                            )}
                          </div>
                          {apt.service_orders && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-xs">
                                {apt.service_orders.order_number}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="h-4 w-4" />
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
                    </div>
                  ))}
                </div>
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
