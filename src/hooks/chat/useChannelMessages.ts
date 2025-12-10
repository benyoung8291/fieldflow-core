import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageWithProfile } from "@/types/chat";
import { RealtimeChannel } from "@supabase/supabase-js";

const MESSAGES_LIMIT = 50;

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
}

export function useChannelMessages(channelId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Start as "connecting" - don't show disconnected banner during initial connection
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: true,
  });
  const hasConnectedOnce = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const query = useQuery({
    queryKey: ["chat-messages", channelId],
    queryFn: async (): Promise<MessageWithProfile[]> => {
      if (!channelId) return [];

      // Fetch messages including soft-deleted ones for reply context
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
          reactions:chat_reactions(
            *,
            profile:profiles!chat_reactions_user_id_fkey(
              id,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(MESSAGES_LIMIT);

      if (error) {
        console.error("[Chat] Error fetching messages:", error);
        throw error;
      }

      // Create a map for quick lookup
      const messageMap = new Map<string, MessageWithProfile>();
      (data || []).forEach((msg) => {
        messageMap.set(msg.id, msg as MessageWithProfile);
      });

      // Attach reply_to data
      const messagesWithReplies = (data || []).map((msg) => {
        const message = msg as MessageWithProfile;
        if (message.reply_to_id && messageMap.has(message.reply_to_id)) {
          message.reply_to = messageMap.get(message.reply_to_id) || null;
        }
        return message;
      });

      return messagesWithReplies;
    },
    enabled: !!channelId,
  });

  // Setup realtime subscription with auto-reconnect
  const setupRealtimeSubscription = useCallback(() => {
    if (!channelId) return;

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log(`[Chat] Setting up realtime for channel: ${channelId}`);

    const channel = supabase
      .channel(`chat-messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          console.log("[Chat] New message received:", payload);
          
          // Check if this is an optimistic message that's now confirmed
          const existingMessages = queryClient.getQueryData<MessageWithProfile[]>(
            ["chat-messages", channelId]
          );
          
          // If we already have this message (optimistic), just update it
          if (existingMessages?.some((m) => m.id === payload.new.id)) {
            return;
          }
          
          // Fetch the complete message with profile
          const { data: newMessage } = await supabase
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
              reactions:chat_reactions(
                *,
                profile:profiles!chat_reactions_user_id_fkey(
                  id,
                  first_name,
                  last_name,
                  avatar_url
                )
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (newMessage) {
            queryClient.setQueryData<MessageWithProfile[]>(
              ["chat-messages", channelId],
              (old) => {
                if (!old) return [newMessage as MessageWithProfile];
                // Avoid duplicates and remove optimistic placeholder
                const filtered = old.filter(
                  (m) => m.id !== newMessage.id && !m.id.startsWith("temp-")
                );
                
                // Attach reply_to if available
                const messageWithProfile = newMessage as MessageWithProfile;
                if (messageWithProfile.reply_to_id) {
                  const replyTo = filtered.find((m) => m.id === messageWithProfile.reply_to_id);
                  if (replyTo) {
                    messageWithProfile.reply_to = replyTo;
                  }
                }
                
                return [...filtered, messageWithProfile];
              }
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log("[Chat] Message updated:", payload);
          
          queryClient.setQueryData<MessageWithProfile[]>(
            ["chat-messages", channelId],
            (old) => {
              if (!old) return old;
              return old.map((msg) =>
                msg.id === payload.new.id
                  ? { ...msg, ...payload.new, profile: msg.profile, reply_to: msg.reply_to }
                  : msg
              );
            }
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log("[Chat] Message deleted:", payload);
          
          queryClient.setQueryData<MessageWithProfile[]>(
            ["chat-messages", channelId],
            (old) => {
              if (!old) return old;
              return old.filter((msg) => msg.id !== payload.old.id);
            }
          );
        }
      )
      .subscribe((status, err) => {
        console.log(`[Chat] Realtime subscription status: ${status}`, err);
        
        if (status === "SUBSCRIBED") {
          hasConnectedOnce.current = true;
          setConnectionState({ isConnected: true, isReconnecting: false });
          reconnectAttempts.current = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Auto-reconnect with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            reconnectAttempts.current++;
            
            // Only show disconnected if we've connected before
            if (hasConnectedOnce.current) {
              setConnectionState({ isConnected: false, isReconnecting: true });
            }
            console.log(`[Chat] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
            
            setTimeout(() => {
              setupRealtimeSubscription();
            }, delay);
          } else {
            // Max attempts reached - silently accept (REST API still works)
            console.log("[Chat] Max reconnect attempts reached, falling back to REST");
            setConnectionState({ isConnected: true, isReconnecting: false });
          }
        } else if (status === "CLOSED") {
          // Only show disconnected if we've successfully connected before
          if (hasConnectedOnce.current) {
            setConnectionState({ isConnected: false, isReconnecting: false });
          } else {
            // Never connected - silently accept
            setConnectionState({ isConnected: true, isReconnecting: false });
          }
        }
      });

    channelRef.current = channel;
  }, [channelId, queryClient]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    setConnectionState({ isConnected: false, isReconnecting: true });
    setupRealtimeSubscription();
  }, [setupRealtimeSubscription]);

  useEffect(() => {
    setupRealtimeSubscription();

    return () => {
      console.log(`[Chat] Cleaning up realtime for channel: ${channelId}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelId, setupRealtimeSubscription]);

  return {
    ...query,
    connectionState,
    reconnect,
  };
}

// Hook for loading older messages (infinite scroll)
export function useOlderMessages(channelId: string | null, oldestMessageId: string | null) {
  return useQuery({
    queryKey: ["chat-messages-older", channelId, oldestMessageId],
    queryFn: async (): Promise<MessageWithProfile[]> => {
      if (!channelId || !oldestMessageId) return [];

      // Get the timestamp of the oldest message
      const { data: oldestMsg } = await supabase
        .from("chat_messages")
        .select("created_at")
        .eq("id", oldestMessageId)
        .single();

      if (!oldestMsg) return [];

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
          reactions:chat_reactions(
            *,
            profile:profiles!chat_reactions_user_id_fkey(
              id,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .eq("channel_id", channelId)
        .lt("created_at", oldestMsg.created_at)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_LIMIT);

      if (error) {
        console.error("[Chat] Error fetching older messages:", error);
        throw error;
      }

      // Reverse to get chronological order
      return (data || []).reverse() as MessageWithProfile[];
    },
    enabled: false, // Manual trigger only
  });
}
