import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TVHeaderProps {
  isConnected: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  currentPage?: number;
  totalPages?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export function TVHeader({ 
  isConnected, 
  dateRange, 
  currentPage = 0, 
  totalPages = 2,
  isPaused = false,
  onTogglePause,
}: TVHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-card border-b border-border">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-3 h-3 rounded-full animate-pulse",
              isConnected ? "bg-success" : "bg-destructive"
            )}
          />
          <span className="text-sm font-medium text-muted-foreground">
            {isConnected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          WORKER AVAILABILITY BOARD
        </h1>
        {dateRange && (
          <span className="text-lg text-muted-foreground ml-2">
            {format(dateRange.start, "MMM d")} - {format(dateRange.end, "MMM d, yyyy")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Pause button */}
        {onTogglePause && (
          <Button
            variant={isPaused ? "default" : "outline"}
            size="sm"
            onClick={onTogglePause}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>
        )}

        {/* Page indicator dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                currentPage === i ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            Days {currentPage * 30 + 1}-{(currentPage + 1) * 30}
          </span>
        </div>

        <div className="text-right">
          <div className="text-2xl font-semibold">
            {format(currentTime, "EEEE, d MMMM yyyy")}
          </div>
          <div className="text-4xl font-bold tabular-nums">
            {format(currentTime, "h:mm:ss a")}
          </div>
        </div>
      </div>
    </header>
  );
}
