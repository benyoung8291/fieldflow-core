import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Optimized wrapper around useQuery that prevents unnecessary refetches
 * and provides better defaults for performance
 */
export function useOptimizedQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError>
) {
  return useQuery({
    ...options,
    staleTime: options.staleTime ?? 1000 * 60 * 5, // 5 min default
    gcTime: options.gcTime ?? 1000 * 60 * 10, // 10 min default
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    refetchOnReconnect: options.refetchOnReconnect ?? false,
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
  }
) {
  const memoizedQueryFn = useCallback(queryFn, []);
  
  return useQuery({
    queryKey,
    queryFn: memoizedQueryFn,
    staleTime: options?.staleTime ?? 1000 * 60 * 3, // 3 min for lists
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: options?.enabled ?? true,
  });
}
