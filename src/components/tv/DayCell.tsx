import { cn } from "@/lib/utils";
import { DayAvailability } from "@/hooks/useWorkerAvailabilityBoard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DayCellProps {
  availability: DayAvailability;
  isToday: boolean;
  isWeekend: boolean;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "p" : "a";
  const hour12 = hour % 12 || 12;
  return `${hour12}${ampm}`;
}

function formatFullTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function DayCell({ availability, isToday, isWeekend }: DayCellProps) {
  const { isAvailable, startTime, endTime, isUnavailable, unavailabilityReason } = availability;

  const getCellContent = () => {
    if (isUnavailable) {
      return <span className="text-xs font-bold">OFF</span>;
    }

    if (isAvailable && startTime) {
      return (
        <span className="text-xs font-medium">
          {formatTime(startTime)}
        </span>
      );
    }

    return <span className="text-xs text-muted-foreground">-</span>;
  };

  const getTooltipContent = () => {
    if (isUnavailable) {
      return (
        <div className="text-center">
          <div className="font-semibold">Unavailable</div>
          {unavailabilityReason && (
            <div className="text-xs text-muted-foreground">
              {unavailabilityReason}
            </div>
          )}
        </div>
      );
    }

    if (isAvailable && startTime && endTime) {
      return (
        <div className="text-center">
          <div className="font-semibold">Available</div>
          <div className="text-sm">
            {formatFullTime(startTime)} - {formatFullTime(endTime)}
          </div>
        </div>
      );
    }

    return <div className="text-center">Not scheduled</div>;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "h-10 flex items-center justify-center transition-colors",
            // Base background
            isWeekend && !isAvailable && !isUnavailable && "bg-muted/50",
            // Available - green
            isAvailable && "bg-success/80 text-success-foreground",
            // Unavailable - red
            isUnavailable && "bg-destructive/80 text-destructive-foreground",
            // Not scheduled - muted
            !isAvailable && !isUnavailable && "bg-muted/30",
            // Today highlight
            isToday && "ring-2 ring-primary ring-inset"
          )}
        >
          {getCellContent()}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover">
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}
