import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SchedulerMonthViewProps {
  currentDate: Date;
  appointments: any[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment: (id: string) => void;
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
  onEditAppointment
}: SchedulerMonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
            <div
              key={day.toISOString()}
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
                {dayAppointments.slice(0, 3).map(apt => (
                  <div
                    key={apt.id}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] cursor-pointer hover:shadow-sm transition-shadow truncate",
                      apt.status === "draft" && "bg-muted text-muted-foreground",
                      apt.status === "published" && "bg-info/10 text-info",
                      apt.status === "checked_in" && "bg-warning/10 text-warning",
                      apt.status === "completed" && "bg-success/10 text-success",
                      apt.status === "cancelled" && "bg-destructive/10 text-destructive"
                    )}
                    onClick={() => onAppointmentClick(apt.id)}
                    title={apt.title}
                  >
                    <div className="flex items-center gap-1">
                      <div 
                        className={cn(
                          "h-1.5 w-1.5 rounded-full flex-shrink-0",
                          statusColors[apt.status as keyof typeof statusColors]
                        )}
                      />
                      <span className="truncate">{apt.title}</span>
                    </div>
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center pt-1">
                    +{dayAppointments.length - 3} more
                  </div>
                )}
              </div>
            </div>
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
    </div>
  );
}
