import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  worker_state: string | null;
}

interface DayData {
  dateStr: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  isSeasonalOverride: boolean;
  seasonalPeriods: string[];
  availableHours: number;
}

interface AvailableWorker {
  worker: Worker;
  dayData: DayData;
}

interface WorkerAvailabilityDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  availableWorkers: AvailableWorker[];
}

const formatTime = (time: string | null): string => {
  if (!time) return "";
  const [hours] = time.split(":");
  const hour = parseInt(hours, 10);
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
};

const formatPeriods = (periods: string[]): string => {
  if (periods.includes("anytime")) return "All day";
  return periods.map(p => p.charAt(0).toUpperCase()).join("+");
};

export function WorkerAvailabilityDayCell({
  date,
  isCurrentMonth,
  isToday,
  isWeekend,
  availableWorkers,
}: WorkerAvailabilityDayCellProps) {
  const dayNumber = format(date, "d");
  const maxVisible = 4;
  const visibleWorkers = availableWorkers.slice(0, maxVisible);
  const remainingCount = availableWorkers.length - maxVisible;

  return (
    <div
      className={cn(
        "min-h-32 border-r border-b last:border-r-0 p-2 transition-colors",
        !isCurrentMonth && "bg-muted/20 opacity-50",
        isWeekend && isCurrentMonth && "bg-muted/10",
        isToday && "ring-2 ring-primary ring-inset"
      )}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium",
            isToday && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center",
            !isCurrentMonth && "text-muted-foreground"
          )}
        >
          {dayNumber}
        </span>
        {availableWorkers.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {availableWorkers.length} available
          </span>
        )}
      </div>

      {/* Worker list */}
      {availableWorkers.length > 0 ? (
        <ScrollArea className="h-[88px]">
          <div className="space-y-0.5">
            {visibleWorkers.map(({ worker, dayData }) => (
              <Tooltip key={worker.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded truncate cursor-default",
                      dayData.isSeasonalOverride
                        ? "bg-warning/10 text-warning border-l-2 border-warning"
                        : "bg-success/10 text-success border-l-2 border-success"
                    )}
                  >
                    <span className="font-medium">
                      {worker.first_name} {worker.last_name.charAt(0)}.
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      {dayData.isSeasonalOverride
                        ? formatPeriods(dayData.seasonalPeriods)
                        : `${formatTime(dayData.startTime)}-${formatTime(dayData.endTime)}`}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="text-sm">
                    <p className="font-medium">
                      {worker.first_name} {worker.last_name}
                    </p>
                    {worker.worker_state && (
                      <p className="text-muted-foreground text-xs">{worker.worker_state}</p>
                    )}
                    <p className="mt-1">
                      {dayData.isSeasonalOverride ? (
                        <>Seasonal: {dayData.seasonalPeriods.join(", ")}</>
                      ) : (
                        <>
                          {dayData.startTime?.slice(0, 5)} - {dayData.endTime?.slice(0, 5)}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayData.availableHours}h available
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
            {remainingCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-muted-foreground px-1.5 py-0.5 cursor-default hover:text-foreground">
                    +{remainingCount} more
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="text-sm space-y-1">
                    {availableWorkers.slice(maxVisible).map(({ worker, dayData }) => (
                      <div key={worker.id}>
                        <span className="font-medium">
                          {worker.first_name} {worker.last_name}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {dayData.isSeasonalOverride
                            ? formatPeriods(dayData.seasonalPeriods)
                            : `${formatTime(dayData.startTime)}-${formatTime(dayData.endTime)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </ScrollArea>
      ) : (
        isCurrentMonth && (
          <div className="text-xs text-muted-foreground italic">
            No workers available
          </div>
        )
      )}
    </div>
  );
}
