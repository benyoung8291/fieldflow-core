import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  lastSeen: string;
  currentPage?: string;
  currentField?: string;
  cursorX?: number;
  cursorY?: number;
}

interface UsePresenceOptions {
  page: string;
  field?: string;
}

export function usePresence({ page, field }: UsePresenceOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
  const [currentUser, setCurrentUser] = useState<PresenceUser | null>(null);

  useEffect(() => {
    // Get current user info
    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const userData: PresenceUser = {
        userId: user.id,
        userName: user.user_metadata?.first_name 
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
          : user.email?.split("@")[0] || "Anonymous",
        userEmail: user.email || "",
        userAvatar: user.user_metadata?.avatar_url,
        lastSeen: new Date().toISOString(),
        currentPage: page,
        currentField: field,
      };

      setCurrentUser(userData);

      // Create presence channel for the page
      const presenceChannel = supabase.channel(`presence:${page}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Track presence state
      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const users: Record<string, PresenceUser> = {};
          
          Object.keys(state).forEach((key) => {
            const presences = state[key] as any[];
            if (presences.length > 0 && presences[0]) {
              // Safely extract presence data
              const presence = presences[0];
              if (presence.userId && presence.userName && presence.userEmail) {
                users[key] = presence as PresenceUser;
              }
            }
          });
          
          setOnlineUsers(users);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          console.log("User joined:", key, newPresences);
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          console.log("User left:", key, leftPresences);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track(userData);
          }
        });

      setChannel(presenceChannel);
    };

    initPresence();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [page]);

  // Update field when it changes
  useEffect(() => {
    if (channel && currentUser) {
      channel.track({
        ...currentUser,
        currentField: field,
        lastSeen: new Date().toISOString(),
      });
    }
  }, [field, channel, currentUser]);

  const updateCursorPosition = (x: number, y: number) => {
    if (channel && currentUser) {
      channel.track({
        ...currentUser,
        cursorX: x,
        cursorY: y,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  const updateField = (newField: string) => {
    if (channel && currentUser) {
      channel.track({
        ...currentUser,
        currentField: newField,
        lastSeen: new Date().toISOString(),
      });
    }
  };

  // Filter out current user from online users
  const otherUsers = Object.entries(onlineUsers)
    .filter(([userId]) => userId !== currentUser?.userId)
    .map(([_, user]) => user);

  return {
    onlineUsers: otherUsers,
    currentUser,
    updateCursorPosition,
    updateField,
  };
}
