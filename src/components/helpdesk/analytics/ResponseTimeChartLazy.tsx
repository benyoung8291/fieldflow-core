import { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';

const ResponseTimeChart = lazy(() => 
  import('./ResponseTimeChart').then(module => ({ default: module.ResponseTimeChart }))
);

interface ResponseTimeChartLazyProps {
  dateRange?: DateRange;
}

const LoadingFallback = () => (
  <Card>
    <CardHeader>
      <CardTitle>Response Time Trends</CardTitle>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[400px] w-full" />
    </CardContent>
  </Card>
);

export const ResponseTimeChartLazy = (props: ResponseTimeChartLazyProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResponseTimeChart {...props} />
    </Suspense>
  );
};
