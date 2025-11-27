import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const CapacityPlanningView = lazy(() => 
  import('./CapacityPlanningView').then(module => ({ default: module.CapacityPlanningView }))
);

interface Worker {
  id: string;
  full_name: string;
  default_hours_per_day?: number;
  working_days?: string[];
}

interface CapacityPlanningViewLazyProps {
  workers: Worker[];
  currentDate: Date;
  onScheduleServiceOrder: (serviceOrderId: string, weekStart: Date, weekEnd: Date) => void;
  successWeek?: Date | null;
}

const LoadingFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-[300px] w-full" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const CapacityPlanningViewLazy = (props: CapacityPlanningViewLazyProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CapacityPlanningView {...props} />
    </Suspense>
  );
};
