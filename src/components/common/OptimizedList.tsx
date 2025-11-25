import React, { memo, useMemo } from "react";

interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
}

/**
 * Optimized list component that uses virtualization concepts
 * and memoization to prevent unnecessary re-renders
 */
function OptimizedListComponent<T>({
  items,
  renderItem,
  keyExtractor,
  emptyMessage = "No items found",
  className,
}: OptimizedListProps<T>) {
  const renderedItems = useMemo(() => {
    return items.map((item, index) => (
      <React.Fragment key={keyExtractor(item, index)}>
        {renderItem(item, index)}
      </React.Fragment>
    ));
  }, [items, renderItem, keyExtractor]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return <div className={className}>{renderedItems}</div>;
}

export const OptimizedList = memo(OptimizedListComponent) as typeof OptimizedListComponent;
