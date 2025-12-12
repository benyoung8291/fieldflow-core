import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  assignedHours: number;
}

interface AvailableWorker {
  worker: Worker;
  dayData: DayData;
}

interface WorkerAvailabilityExpandedViewProps {
  date: Date;
  availableWorkers: AvailableWorker[];
  trigger: React.ReactNode;
}

const formatTime = (time: string | null): string => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const min = minutes !== "00" ? `:${minutes}` : "";
  if (hour === 0) return `12${min}am`;
  if (hour < 12) return `${hour}${min}am`;
  if (hour === 12) return `12${min}pm`;
  return `${hour - 12}${min}pm`;
};

const formatPeriods = (periods: string[]): string => {
  if (periods.includes("anytime")) return "All day";
  return periods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
};

const getWorkerStatusColor = (dayData: DayData) => {
  const remainingHours = dayData.availableHours - dayData.assignedHours;

  if (dayData.assignedHours >= dayData.availableHours || dayData.assignedHours >= 8) {
    return "bg-blue-500/10 text-blue-600 border-l-2 border-blue-500 dark:text-blue-400";
  } else if (dayData.assignedHours > 0 && remainingHours > 0) {
    return "bg-orange-500/10 text-orange-600 border-l-2 border-orange-500 dark:text-orange-400";
  } else if (dayData.isSeasonalOverride) {
    return "bg-warning/10 text-warning border-l-2 border-warning";
  } else {
    return "bg-success/10 text-success border-l-2 border-success";
  }
};

const getStatusLabel = (dayData: DayData) => {
  const remainingHours = dayData.availableHours - dayData.assignedHours;

  if (dayData.assignedHours >= dayData.availableHours || dayData.assignedHours >= 8) {
    return "Fully Booked";
  } else if (dayData.assignedHours > 0 && remainingHours > 0) {
    return "Partially Assigned";
  } else if (dayData.isSeasonalOverride) {
    return "Seasonal";
  } else {
    return "Available";
  }
};

export function WorkerAvailabilityExpandedView({
  date,
  availableWorkers,
  trigger,
}: WorkerAvailabilityExpandedViewProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Workers Available - {format(date, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {availableWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No workers available on this date
              </p>
            ) : (
              availableWorkers.map(({ worker, dayData }) => {
                const remainingHours = Math.max(0, dayData.availableHours - dayData.assignedHours);
                
                return (
                  <div
                    key={worker.id}
                    className={cn(
                      "p-3 rounded-lg",
                      getWorkerStatusColor(dayData)
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {worker.first_name} {worker.last_name}
                        </p>
                        {worker.worker_state && (
                          <p className="text-xs text-muted-foreground">
                            {worker.worker_state}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-background/50">
                        {getStatusLabel(dayData)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm">
                      <p>
                        {dayData.isSeasonalOverride
                          ? formatPeriods(dayData.seasonalPeriods)
                          : `${formatTime(dayData.startTime)} - ${formatTime(dayData.endTime)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dayData.assignedHours > 0
                          ? `${dayData.assignedHours}h assigned, ${remainingHours}h remaining`
                          : `${dayData.availableHours}h available`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
