import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, MapPin } from "lucide-react";

interface SchedulerWeekViewProps {
  currentDate: Date;
}

const mockWorkers = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Sarah Johnson" },
  { id: "3", name: "Mike Davis" },
];

const mockAppointments = [
  {
    id: "1",
    title: "HVAC Installation",
    workerId: "1",
    date: new Date(),
    startTime: "09:00",
    endTime: "11:00",
    status: "published",
  },
  {
    id: "2",
    title: "Plumbing Repair",
    workerId: "1",
    date: new Date(),
    startTime: "14:00",
    endTime: "16:00",
    status: "checked_in",
  },
  {
    id: "3",
    title: "Electrical Check",
    workerId: "3",
    date: new Date(Date.now() + 86400000), // Tomorrow
    startTime: "10:00",
    endTime: "12:00",
    status: "published",
  },
];

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-info/10 text-info",
  checked_in: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function SchedulerWeekView({ currentDate }: SchedulerWeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      {/* Header with days */}
      <div className="grid grid-cols-[150px_repeat(7,1fr)] gap-2">
        <div className="text-sm font-medium text-muted-foreground">Worker</div>
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
      <div className="space-y-2">
        {mockWorkers.map(worker => (
          <div key={worker.id} className="grid grid-cols-[150px_repeat(7,1fr)] gap-2">
            {/* Worker name */}
            <div className="flex items-center px-3 py-2 bg-muted rounded-lg">
              <span className="text-sm font-medium truncate">{worker.name}</span>
            </div>

            {/* Day cells */}
            {weekDays.map(day => {
              const dayAppointments = mockAppointments.filter(
                apt => apt.workerId === worker.id && isSameDay(apt.date, day)
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
                        "p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow",
                        statusColors[apt.status as keyof typeof statusColors]
                      )}
                    >
                      <div className="font-medium truncate">{apt.title}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{apt.startTime}</span>
                      </div>
                    </div>
                  ))}
                  {dayAppointments.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      Drop here
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
