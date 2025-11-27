import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const WorkerLocationMap = lazy(() => 
  import('./WorkerLocationMap').then(module => ({ default: module.WorkerLocationMap }))
);

interface WorkerLocationMapLazyProps {
  activeWorkers: any[];
}

const LoadingFallback = () => (
  <Card>
    <CardContent className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

export const WorkerLocationMapLazy = (props: WorkerLocationMapLazyProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WorkerLocationMap {...props} />
    </Suspense>
  );
};
