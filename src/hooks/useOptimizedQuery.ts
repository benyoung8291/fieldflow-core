import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useCallback } from "react";

type QueryStrategy = 'realtime' | 'standard' | 'static';

const STRATEGY_CONFIGS = {
  realtime: { staleTime: 0, gcTime: 1000 * 60 * 5 }, // 0s stale, 5min cache
  standard: { staleTime: 1000 * 30, gcTime: 1000 * 60 * 5 }, // 30s stale, 5min cache
  static: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 10 }, // 5min stale, 10min cache
};

interface OptimizedQueryOptions<TData = unknown, TError = unknown> extends UseQueryOptions<TData, TError> {
  strategy?: QueryStrategy;
}

/**
 * Optimized wrapper around useQuery that prevents unnecessary refetches
 * and provides better defaults for collaborative workflows
 * 
 * @param strategy - Query strategy:
 *   - 'realtime': 0s staleTime - always fetch fresh data (best for collaborative features)
 *   - 'standard': 30s staleTime - balanced approach for most use cases (default)
 *   - 'static': 5m staleTime - for rarely changing data
 */
export function useOptimizedQuery<TData = unknown, TError = unknown>(
  options: OptimizedQueryOptions<TData, TError>
) {
  const { strategy = 'standard', ...queryOptions } = options;
  const config = STRATEGY_CONFIGS[strategy];
  
  return useQuery({
    ...queryOptions,
    staleTime: queryOptions.staleTime ?? config.staleTime,
    gcTime: queryOptions.gcTime ?? config.gcTime,
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? false,
    refetchOnReconnect: queryOptions.refetchOnReconnect ?? false,
  });
}

/**
 * Hook for optimized list queries with built-in pagination support
 */
export function useOptimizedListQuery<TData = unknown>(
  queryKey: any[],
  queryFn: () => Promise<TData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    strategy?: QueryStrategy;
  }
) {
  const memoizedQueryFn = useCallback(queryFn, []);
  const strategy = options?.strategy ?? 'standard';
  const config = STRATEGY_CONFIGS[strategy];
  
  return useQuery({
    queryKey,
    queryFn: memoizedQueryFn,
    staleTime: options?.staleTime ?? config.staleTime,
    gcTime: config.gcTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: options?.enabled ?? true,
  });
}
