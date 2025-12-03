import { useEffect, useState } from "react";
import { useWorkerAvailabilityBoard } from "@/hooks/useWorkerAvailabilityBoard";
import { TVHeader } from "@/components/tv/TVHeader";
import { AvailabilityGrid30Day } from "@/components/tv/AvailabilityGrid30Day";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

export default function TVAvailabilityDashboard() {
  const { groupedWorkers, days, isLoading, isConnected } = useWorkerAvailabilityBoard();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen toggle with 'F' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
          setIsFullscreen(false);
        } else {
          document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TVHeader isConnected={false} />
        <div className="p-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <TVHeader isConnected={isConnected} />

        <main className="flex-1 p-6 overflow-auto">
          {/* Full-Time Employees */}
          <AvailabilityGrid30Day
            workers={groupedWorkers.fullTime}
            days={days}
            title="FULL-TIME EMPLOYEES"
            emptyMessage="No full-time employees"
          />

          {/* Casual Employees */}
          <AvailabilityGrid30Day
            workers={groupedWorkers.casual}
            days={days}
            title="CASUAL EMPLOYEES"
            emptyMessage="No casual employees"
          />

          {/* On Leave Section */}
          {groupedWorkers.unavailableWorkers.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-3 px-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                ON EXTENDED LEAVE ({groupedWorkers.unavailableWorkers.length})
              </h2>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="grid gap-2">
                  {groupedWorkers.unavailableWorkers.map(({ worker, unavailability }) => (
                    <div
                      key={worker.id}
                      className="flex items-center justify-between bg-card rounded p-3"
                    >
                      <span className="font-medium">
                        {worker.first_name} {worker.last_name}
                      </span>
                      <span className="text-muted-foreground">
                        {unavailability.reason || "Leave"} •{" "}
                        {format(new Date(unavailability.start_date), "d MMM")} -{" "}
                        {format(new Date(unavailability.end_date), "d MMM")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-success/80" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-muted/30" />
              <span>Not Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-destructive/80" />
              <span>On Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded ring-2 ring-primary ring-inset" />
              <span>Today</span>
            </div>
            <div className="text-muted-foreground ml-4">
              Press <kbd className="px-2 py-0.5 bg-muted rounded text-xs">F</kbd> for fullscreen
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
