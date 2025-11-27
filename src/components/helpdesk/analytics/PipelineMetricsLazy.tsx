import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';

const PipelineMetrics = lazy(() => 
  import('./PipelineMetrics').then(module => ({ default: module.PipelineMetrics }))
);

interface PipelineMetricsLazyProps {
  dateRange?: DateRange;
}

const LoadingFallback = () => (
  <Card>
    <CardHeader>
      <CardTitle>Pipeline Distribution</CardTitle>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[300px] w-full" />
    </CardContent>
  </Card>
);

export const PipelineMetricsLazy = (props: PipelineMetricsLazyProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PipelineMetrics {...props} />
    </Suspense>
  );
};
