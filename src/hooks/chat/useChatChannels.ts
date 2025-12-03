import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatChannel } from "@/types/chat";

export function useChatChannels() {
  return useQuery({
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
