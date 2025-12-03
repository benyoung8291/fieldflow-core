import { cn } from "@/lib/utils";
import { WorkerAvailability } from "@/hooks/useWorkerAvailabilityBoard";
import { DayCell } from "./DayCell";
import { format, getDay } from "date-fns";

interface Day {
  date: Date;
  dateStr: string;
  dayOfWeek: number;
  dayNumber: string;
  dayName: string;
  month: string;
  isToday: boolean;
  isWeekend: boolean;
}

interface AvailabilityGrid30DayProps {
  workers: WorkerAvailability[];
  days: Day[];
  title: string;
  emptyMessage?: string;
}

export function AvailabilityGrid30Day({
  workers,
  days,
  title,
  emptyMessage = "No workers in this category",
}: AvailabilityGrid30DayProps) {
  if (workers.length === 0) {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3 px-2">{title} (0)</h2>
        <div className="text-muted-foreground text-center py-4">{emptyMessage}</div>
      </div>
    );
  }

  // Group days by month for header
  const monthGroups: { month: string; days: Day[] }[] = [];
  let currentMonth = "";
  days.forEach((day) => {
    if (day.month !== currentMonth) {
      currentMonth = day.month;
      monthGroups.push({ month: day.month, days: [day] });
    } else {
      monthGroups[monthGroups.length - 1].days.push(day);
    }
  });

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-3 px-2">
        {title} ({workers.length})
      </h2>
      
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Month Header Row */}
          <div className="flex border-b border-border">
            <div className="w-40 shrink-0 bg-card" />
            {monthGroups.map((group, idx) => (
              <div
                key={`${group.month}-${idx}`}
                className="text-center font-semibold text-sm py-1 bg-muted/50 border-l border-border first:border-l-0"
                style={{ width: `${group.days.length * 48}px` }}
              >
                {group.month}
              </div>
            ))}
          </div>

          {/* Day Numbers Row */}
          <div className="flex border-b border-border">
            <div className="w-40 shrink-0 bg-card" />
            {days.map((day) => (
              <div
                key={day.dateStr}
                className={cn(
                  "w-12 text-center text-sm font-medium py-1",
                  day.isToday && "bg-primary text-primary-foreground",
                  day.isWeekend && !day.isToday && "bg-muted/50"
                )}
              >
                {day.dayNumber}
              </div>
            ))}
          </div>

          {/* Day Names Row */}
          <div className="flex border-b border-border">
            <div className="w-40 shrink-0 bg-card text-xs font-medium text-muted-foreground px-2 py-1">
              Worker
            </div>
            {days.map((day) => (
              <div
                key={`name-${day.dateStr}`}
                className={cn(
                  "w-12 text-center text-xs text-muted-foreground py-1",
                  day.isToday && "bg-primary/20 font-medium",
                  day.isWeekend && !day.isToday && "bg-muted/30"
                )}
              >
                {day.dayName}
              </div>
            ))}
          </div>

          {/* Worker Rows */}
          {workers.map((workerAvail) => (
            <div key={workerAvail.worker.id} className="flex border-b border-border/50 hover:bg-muted/20">
              <div className="w-40 shrink-0 bg-card px-2 py-2 font-medium text-sm truncate border-r border-border">
                {workerAvail.worker.first_name} {workerAvail.worker.last_name}
              </div>
              {workerAvail.days.map((dayAvail, idx) => (
                <div key={dayAvail.dateStr} className="w-12">
                  <DayCell
                    availability={dayAvail}
                    isToday={days[idx].isToday}
                    isWeekend={days[idx].isWeekend}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
