import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  threshold: number;
}

export const PullToRefreshIndicator = ({
  isPulling,
  isRefreshing,
  pullDistance,
  threshold,
}: PullToRefreshIndicatorProps) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const isActive = isPulling || isRefreshing;

  return (
    <div
      className={cn(
        "absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 z-50",
        isActive ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{
        transform: `translateY(${isPulling ? pullDistance : 0}px)`,
      }}
    >
      <div className="bg-background/95 backdrop-blur-sm shadow-lg rounded-full p-3 border border-border">
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="relative h-5 w-5">
            <svg
              className="transform -rotate-90"
              width="20"
              height="20"
              viewBox="0 0 20 20"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-muted"
                opacity="0.2"
              />
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-primary transition-all duration-200"
                strokeDasharray={`${progress * 50.27} 50.27`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
