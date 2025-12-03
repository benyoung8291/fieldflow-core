import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageWithProfile } from "@/types/chat";

interface UseMessageSearchOptions {
  channelId: string;
  enabled?: boolean;
}

// Simple debounce hook
function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useMessageSearch({ channelId, enabled = true }: UseMessageSearchOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ["chat-message-search", channelId, debouncedQuery],
    queryFn: async (): Promise<MessageWithProfile[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          profile:profiles!chat_messages_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          ),
          attachments:chat_attachments(*),
          reactions:chat_reactions(*)
        `)
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .ilike("content", `%${debouncedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("[Chat] Search error:", error);
        throw error;
      }

      return (data || []).map((msg) => ({
        ...msg,
        profile: msg.profile || null,
        attachments: msg.attachments || [],
        reactions: msg.reactions || [],
      })) as MessageWithProfile[];
    },
    enabled: enabled && !!channelId && debouncedQuery.length >= 2,
  });

  return {
    searchQuery,
    setSearchQuery,
    results,
    isLoading,
    error,
    hasQuery: debouncedQuery.length >= 2,
  };
}
