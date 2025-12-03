import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TVHeaderProps {
  isConnected: boolean;
}

export function TVHeader({ isConnected }: TVHeaderProps) {
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
      </div>

      <div className="flex items-center gap-6 text-right">
        <div>
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
