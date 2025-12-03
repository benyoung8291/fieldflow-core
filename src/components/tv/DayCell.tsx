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

function getAssignedPercentage(available: number, assigned: number): number {
  if (available <= 0) return 0;
  return Math.min(100, (assigned / available) * 100);
}

function getProgressBarColor(percentage: number): string {
  if (percentage >= 100) return "bg-destructive";
  if (percentage >= 75) return "bg-orange-500";
  if (percentage >= 50) return "bg-amber-500";
  return "bg-success";
}

export function DayCell({ availability, isToday, isWeekend }: DayCellProps) {
  const { 
    isAvailable, 
    startTime, 
    endTime, 
    isUnavailable, 
    unavailabilityReason,
    availableHours,
    assignedHours,
    isSeasonalOverride,
  } = availability;

  const assignedPercentage = getAssignedPercentage(availableHours, assignedHours);

  const getCellContent = () => {
    if (isUnavailable) {
      return <span className="text-[10px] font-bold">OFF</span>;
    }

    if (isAvailable && startTime) {
      return (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] font-medium leading-none">
            {formatTime(startTime)}
          </span>
          {isSeasonalOverride && (
            <span className="text-[8px] opacity-70">★</span>
          )}
        </div>
      );
    }

    return <span className="text-[10px] text-muted-foreground">-</span>;
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
      const remainingHours = Math.max(0, availableHours - assignedHours);
      return (
        <div className="text-center space-y-1">
          <div className="font-semibold">
            {isSeasonalOverride ? "Seasonal Availability" : "Available"}
          </div>
          <div className="text-sm">
            {formatFullTime(startTime)} - {formatFullTime(endTime)}
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Available: {availableHours.toFixed(1)} hrs</div>
            <div>Assigned: {assignedHours.toFixed(1)} hrs</div>
            <div className="font-medium">Remaining: {remainingHours.toFixed(1)} hrs</div>
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
            "h-8 flex flex-col items-center justify-center transition-colors relative",
            // Base background
            isWeekend && !isAvailable && !isUnavailable && "bg-muted/50",
            // Available - green (seasonal gets amber tint)
            isAvailable && !isSeasonalOverride && "bg-success/80 text-success-foreground",
            isAvailable && isSeasonalOverride && "bg-amber-500/80 text-amber-foreground",
            // Unavailable - red
            isUnavailable && "bg-destructive/80 text-destructive-foreground",
            // Not scheduled - muted
            !isAvailable && !isUnavailable && "bg-muted/30",
            // Today highlight
            isToday && "ring-2 ring-primary ring-inset"
          )}
        >
          {getCellContent()}
          
          {/* Hours progress bar */}
          {isAvailable && availableHours > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
              <div 
                className={cn(
                  "h-full transition-all",
                  getProgressBarColor(assignedPercentage)
                )}
                style={{ width: `${assignedPercentage}%` }}
              />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover">
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}
