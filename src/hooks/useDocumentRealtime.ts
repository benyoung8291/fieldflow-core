import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

interface UseDocumentRealtimeOptions {
  table: string;
  id: string | undefined;
  queryKey: string[];
  onUpdate?: (payload: any) => void;
}

/**
 * Hook to listen for real-time updates on a document
 * Automatically refreshes queries when document changes
 */
export function useDocumentRealtime({
  table,
  id,
  queryKey,
  onUpdate,
}: UseDocumentRealtimeOptions) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!id) return;

    console.log(`[Realtime] Setting up listener for ${table}:${id}`);

    // Create a channel for this specific document
    const channel = supabase
      .channel(`${table}:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: table,
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log(`[Realtime] ${table} updated:`, payload);
          
          // Invalidate the query to refetch fresh data
          queryClient.invalidateQueries({ queryKey });
          
          // Call custom callback if provided
          if (onUpdate) {
            onUpdate(payload);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status for ${table}:${id}:`, status);
      });

    channelRef.current = channel;

    return () => {
      console.log(`[Realtime] Cleaning up listener for ${table}:${id}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, id, queryKey, queryClient, onUpdate]);

  return { channel: channelRef.current };
}