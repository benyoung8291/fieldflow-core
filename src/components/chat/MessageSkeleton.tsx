import { Skeleton } from "@/components/ui/skeleton";

interface MessageSkeletonProps {
  count?: number;
}

export function MessageSkeleton({ count = 5 }: MessageSkeletonProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 3 === 0;
        const hasAttachment = i % 4 === 0;
        
        return (
          <div
            key={i}
            className={`flex gap-2 ${isRight ? "flex-row-reverse" : "flex-row"}`}
          >
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
              {!isRight && <Skeleton className="h-3 w-20" />}
              <Skeleton 
                className={`h-12 rounded-2xl ${
                  i % 2 === 0 ? "w-48" : "w-64"
                }`} 
              />
              {hasAttachment && (
                <Skeleton className="h-32 w-48 rounded-lg" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
