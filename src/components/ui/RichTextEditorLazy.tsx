import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const RichTextEditor = lazy(() => 
  import('./rich-text-editor').then(module => ({ default: module.RichTextEditor }))
);

interface RichTextEditorLazyProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const LoadingFallback = () => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-[200px] w-full" />
  </div>
);

export const RichTextEditorLazy = React.forwardRef<any, RichTextEditorLazyProps>(
  (props, ref) => {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RichTextEditor ref={ref} {...props} />
      </Suspense>
    );
  }
);

RichTextEditorLazy.displayName = 'RichTextEditorLazy';
