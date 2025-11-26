import { Loader2 } from 'lucide-react';
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

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
      }}
    >
      <div className="bg-background/95 backdrop-blur-sm border rounded-full p-2 shadow-lg">
        <Loader2
          className={cn(
            'h-5 w-5 text-primary transition-transform',
            isRefreshing ? 'animate-spin' : ''
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 3.6}deg)`,
          }}
        />
      </div>
    </div>
  );
}
