import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UnreadCounts {
  totalUnread: number;
  channelUnreadCounts: Record<string, number>;
}

export function useUnreadMessages() {
  return useQuery({
    queryKey: ["chat-unread-counts"],
    queryFn: async (): Promise<UnreadCounts> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { totalUnread: 0, channelUnreadCounts: {} };
      }

      // Fetch all channel memberships with last_read_at
      const { data: memberships, error: membershipError } = await supabase
        .from("chat_channel_members")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id);

      if (membershipError) {
        console.error("[Chat] Error fetching memberships:", membershipError);
        throw membershipError;
      }

      if (!memberships || memberships.length === 0) {
        return { totalUnread: 0, channelUnreadCounts: {} };
      }

      // For each channel, count messages after last_read_at
      const channelUnreadCounts: Record<string, number> = {};
      let totalUnread = 0;

      await Promise.all(
        memberships.map(async (membership) => {
          const { count, error } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", membership.channel_id)
            .gt("created_at", membership.last_read_at)
            .neq("user_id", user.id) // Don't count own messages as unread
            .is("deleted_at", null);

          if (error) {
            console.error("[Chat] Error counting unread:", error);
            return;
          }

          const unreadCount = count || 0;
          if (unreadCount > 0) {
            channelUnreadCounts[membership.channel_id] = unreadCount;
            totalUnread += unreadCount;
          }
        })
      );

      return { totalUnread, channelUnreadCounts };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
