import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DMChannelInfo {
  otherUserId: string | null;
  otherUserName: string;
  otherUserAvatar: string | null;
}

export function useDMChannelName(channelId: string | null) {
  return useQuery({
    queryKey: ["dm-channel-name", channelId],
    queryFn: async (): Promise<DMChannelInfo | null> => {
      if (!channelId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get channel members
      const { data: members, error } = await supabase
        .from("chat_channel_members")
        .select(`
          user_id,
          profile:profiles!chat_channel_members_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq("channel_id", channelId);

      if (error || !members) return null;

      // Find the other user (not current user)
      const otherMember = members.find((m) => m.user_id !== user.id);
      
      if (!otherMember || !otherMember.profile) {
        return {
          otherUserId: null,
          otherUserName: "Direct Message",
          otherUserAvatar: null,
        };
      }

      const profile = otherMember.profile as any;
      const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";

      return {
        otherUserId: profile.id,
        otherUserName: name,
        otherUserAvatar: profile.avatar_url,
      };
    },
    enabled: !!channelId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Bulk fetch DM names for multiple channels
export function useDMChannelNames(channelIds: string[]) {
  return useQuery({
    queryKey: ["dm-channel-names", channelIds.sort().join(",")],
    queryFn: async (): Promise<Record<string, DMChannelInfo>> => {
      if (channelIds.length === 0) return {};

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      // Get all members for these channels
      const { data: members, error } = await supabase
        .from("chat_channel_members")
        .select(`
          channel_id,
          user_id,
          profile:profiles!chat_channel_members_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .in("channel_id", channelIds);

      if (error || !members) return {};

      const result: Record<string, DMChannelInfo> = {};

      channelIds.forEach((channelId) => {
        const channelMembers = members.filter((m) => m.channel_id === channelId);
        const otherMember = channelMembers.find((m) => m.user_id !== user.id);

        if (!otherMember || !otherMember.profile) {
          result[channelId] = {
            otherUserId: null,
            otherUserName: "Direct Message",
            otherUserAvatar: null,
          };
        } else {
          const profile = otherMember.profile as any;
          const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";
          result[channelId] = {
            otherUserId: profile.id,
            otherUserName: name,
            otherUserAvatar: profile.avatar_url,
          };
        }
      });

      return result;
    },
    enabled: channelIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
