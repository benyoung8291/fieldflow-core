import { useEffect, useState } from "react";
import { useWorkerAvailabilityBoard } from "@/hooks/useWorkerAvailabilityBoard";
import { TVHeader } from "@/components/tv/TVHeader";
import { AvailabilityGrid30Day } from "@/components/tv/AvailabilityGrid30Day";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { AlertCircle } from "lucide-react";

export default function TVAvailabilityDashboard() {
  const { groupedWorkers, days, isLoading, isConnected } = useWorkerAvailabilityBoard();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TVHeader isConnected={false} />
        <div className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Sort states alphabetically
  const sortedStates = Object.keys(groupedWorkers.byState).sort();

  // Check if there are any workers at all
  const totalWorkers = sortedStates.reduce(
    (sum, state) => sum + groupedWorkers.byState[state].length,
    0
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <TVHeader isConnected={isConnected} />

        <main className="flex-1 p-3 overflow-auto">
          {totalWorkers === 0 && groupedWorkers.unavailableWorkers.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground text-lg">No workers with availability found</p>
            </div>
          ) : (
            <>
              {/* State-based worker groups */}
              {sortedStates.map((state) => (
                <AvailabilityGrid30Day
                  key={state}
                  workers={groupedWorkers.byState[state]}
                  days={days}
                  title={state}
                />
              ))}

              {/* Workers on Extended Leave */}
              {groupedWorkers.unavailableWorkers.length > 0 && (
                <div className="mt-4 mb-4">
                  <h2 className="text-lg font-bold mb-2 px-2 flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    On Extended Leave ({groupedWorkers.unavailableWorkers.length})
                  </h2>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {groupedWorkers.unavailableWorkers.map(({ worker, unavailability }) => (
                        <div
                          key={worker.id}
                          className="flex items-center gap-2 text-sm bg-card rounded px-2 py-1"
                        >
                          <span className="font-medium">
                            {worker.first_name} {worker.last_name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {unavailability.reason || "Leave"} (
                            {format(parseISO(unavailability.start_date), "MMM d")} -{" "}
                            {format(parseISO(unavailability.end_date), "MMM d")})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Legend */}
        <footer className="bg-card border-t border-border px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-success/80" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-500/80" />
                <span>Seasonal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-destructive/80" />
                <span>Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-muted/50" />
                <span>Not Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4 border-l border-border pl-4">
                <div className="w-12 h-2 rounded bg-gradient-to-r from-success via-amber-500 to-destructive" />
                <span>Hours Assigned (0% → 100%)</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">F</kbd> for fullscreen
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
