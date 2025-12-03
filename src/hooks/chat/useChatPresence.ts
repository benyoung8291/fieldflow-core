import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  id: string;
  name: string;
  avatar_url: string | null;
  online_at: string;
}

export function useChatPresence() {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceUser>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-for-presence"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, tenant_id")
        .eq("id", user.id)
        .single();

      return profile;
    },
  });

  useEffect(() => {
    if (!currentUser?.tenant_id) return;

    const presenceChannel = supabase.channel(`chat-presence:${currentUser.tenant_id}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const users = new Map<string, PresenceUser>();

        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as any;
            users.set(key, {
              id: key,
              name: presence.name || "Unknown",
              avatar_url: presence.avatar_url,
              online_at: presence.online_at,
            });
          }
        });

        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setOnlineUsers((prev) => {
            const next = new Map(prev);
            next.set(key, {
              id: key,
              name: presence.name || "Unknown",
              avatar_url: presence.avatar_url,
              online_at: presence.online_at,
            });
            return next;
          });
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            name: `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || "User",
            avatar_url: currentUser.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [currentUser?.id, currentUser?.tenant_id]);

  const isUserOnline = (userId: string) => onlineUsers.has(userId);

  return {
    onlineUsers,
    isUserOnline,
    onlineCount: onlineUsers.size,
  };
}
