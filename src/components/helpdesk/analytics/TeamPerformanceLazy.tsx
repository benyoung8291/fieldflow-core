import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';

const TeamPerformance = lazy(() => 
  import('./TeamPerformance').then(module => ({ default: module.TeamPerformance }))
);

interface TeamPerformanceLazyProps {
  dateRange?: DateRange;
}

const LoadingFallback = () => (
  <Card>
    <CardHeader>
      <CardTitle>Team Performance</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

export const TeamPerformanceLazy = (props: TeamPerformanceLazyProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TeamPerformance {...props} />
    </Suspense>
  );
};
