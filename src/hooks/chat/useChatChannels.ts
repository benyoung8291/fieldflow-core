import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatChannel } from "@/types/chat";

export function useChatChannels() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-channels"],
    queryFn: async (): Promise<ChatChannel[]> => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Chat] Error fetching channels:", error);
        throw error;
      }

      return data || [];
    },
  });

  // Real-time subscription for channel list updates
  useEffect(() => {
    let currentUserId: string | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id || null;

      if (!currentUserId) return;

      const channel = supabase
        .channel('chat-channels-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_channels' },
          (payload) => {
            console.log('[Chat Realtime] Channel change:', payload.eventType);
            queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_channel_members' },
          (payload) => {
            // If current user was added to a channel, refetch
            if (payload.new && (payload.new as any).user_id === currentUserId) {
              console.log('[Chat Realtime] Added to new channel');
              queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
            }
          }
        )
        .subscribe((status) => {
          console.log('[Chat Realtime] Channels subscription:', status);
        });

      return channel;
    };

    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    setupSubscription().then(ch => { channelRef = ch || null; });

    return () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [queryClient]);

  return query;
}

export function useChatChannel(channelId: string | null) {
  return useQuery({
    queryKey: ["chat-channel", channelId],
    queryFn: async (): Promise<ChatChannel | null> => {
      if (!channelId) return null;

      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("id", channelId)
        .single();

      if (error) {
        console.error("[Chat] Error fetching channel:", error);
        throw error;
      }

      return data;
    },
    enabled: !!channelId,
  });
}

export function useChannelMembers(channelId: string | null) {
  return useQuery({
    queryKey: ["chat-channel-members", channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const { data, error } = await supabase
        .from("chat_channel_members")
        .select(`
          *,
          profile:profiles!chat_channel_members_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq("channel_id", channelId);

      if (error) {
        console.error("[Chat] Error fetching channel members:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!channelId,
  });
}
