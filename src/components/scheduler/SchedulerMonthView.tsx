import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SchedulerMonthViewProps {
  currentDate: Date;
}

const mockAppointments = [
  {
    id: "1",
    title: "HVAC Installation",
    date: new Date(),
    count: 3,
    status: "published",
  },
  {
    id: "2",
    title: "Plumbing Repair",
    date: new Date(),
    count: 2,
    status: "checked_in",
  },
  {
    id: "3",
    title: "Electrical Check",
    date: new Date(Date.now() + 86400000),
    count: 4,
    status: "published",
  },
];

const statusColors = {
  draft: "bg-muted",
  published: "bg-info",
  checked_in: "bg-warning",
  completed: "bg-success",
  cancelled: "bg-destructive",
};

export default function SchedulerMonthView({ currentDate }: SchedulerMonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-2">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map(day => {
          const dayAppointments = mockAppointments.filter(apt => 
            isSameDay(apt.date, day)
          );
          const totalAppointments = dayAppointments.reduce((sum, apt) => sum + apt.count, 0);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[120px] p-2 border rounded-lg",
                !isSameMonth(day, currentDate) && "bg-muted/30 text-muted-foreground",
                isSameMonth(day, currentDate) && "bg-background border-border",
                isToday(day) && "border-2 border-primary bg-primary/5"
              )}
            >
              <div className={cn(
                "text-sm font-medium mb-2",
                isToday(day) && "text-primary font-bold"
              )}>
                {format(day, "d")}
              </div>

              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map(apt => (
                  <div
                    key={apt.id}
                    className={cn(
                      "h-1 rounded-full",
                      statusColors[apt.status as keyof typeof statusColors]
                    )}
                  />
                ))}
                {totalAppointments > 0 && (
                  <div className="text-xs text-muted-foreground pt-1">
                    {totalAppointments} appointment{totalAppointments !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
