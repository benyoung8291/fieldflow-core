import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const isVisible = pullDistance > 0 || isRefreshing;
  const isThresholdMet = pullDistance >= threshold;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none',
        'transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold + 10)}px)`,
        transition: isRefreshing || pullDistance === 0 
          ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
          : 'none',
      }}
    >
      <div className={cn(
        "bg-background/95 backdrop-blur-sm border rounded-full shadow-lg",
        "transition-all duration-200",
        isThresholdMet ? "p-3 scale-110" : "p-2 scale-100"
      )}>
        <div className="relative flex items-center justify-center">
          {/* Progress Ring */}
          <svg className="w-8 h-8 -rotate-90 absolute" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className={cn(
                "transition-all duration-200",
                isThresholdMet ? "text-primary" : "text-muted-foreground/30"
              )}
              strokeDasharray={`${(progress / 100) * 87.96} 87.96`}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Icon */}
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : isThresholdMet ? (
            <Check className="h-5 w-5 text-primary animate-scale-in" />
          ) : (
            <Loader2 
              className="h-5 w-5 text-muted-foreground transition-all"
              style={{
                transform: `rotate(${progress * 3.6}deg)`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
