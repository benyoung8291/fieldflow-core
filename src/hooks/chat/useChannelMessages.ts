import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageWithProfile } from "@/types/chat";
import { RealtimeChannel } from "@supabase/supabase-js";

const MESSAGES_LIMIT = 50;

export function useChannelMessages(channelId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

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
          reactions:chat_reactions(*)
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

  useEffect(() => {
    if (!channelId) return;

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
              reactions:chat_reactions(*)
            `)
            .eq("id", payload.new.id)
            .single();

          if (newMessage) {
            queryClient.setQueryData<MessageWithProfile[]>(
              ["chat-messages", channelId],
              (old) => {
                if (!old) return [newMessage as MessageWithProfile];
                // Avoid duplicates
                if (old.some((m) => m.id === newMessage.id)) return old;
                
                // Attach reply_to if available
                const messageWithProfile = newMessage as MessageWithProfile;
                if (messageWithProfile.reply_to_id) {
                  const replyTo = old.find((m) => m.id === messageWithProfile.reply_to_id);
                  if (replyTo) {
                    messageWithProfile.reply_to = replyTo;
                  }
                }
                
                return [...old, messageWithProfile];
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
      .subscribe((status) => {
        console.log(`[Chat] Realtime subscription status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      console.log(`[Chat] Cleaning up realtime for channel: ${channelId}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelId, queryClient]);

  return query;
}
