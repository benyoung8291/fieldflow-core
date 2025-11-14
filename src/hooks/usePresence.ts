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
  isTyping?: boolean;
  typingInField?: string;
  color?: string;
}

interface UsePresenceOptions {
  page: string;
  field?: string;
}

const USER_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

let userColorMap: { [key: string]: string } = {};
let colorIndex = 0;

const getUserColor = (userId: string): string => {
  if (!userColorMap[userId]) {
    userColorMap[userId] = USER_COLORS[colorIndex % USER_COLORS.length];
    colorIndex++;
  }
  return userColorMap[userId];
};

export function usePresence({ page, field }: UsePresenceOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
  const [currentUser, setCurrentUser] = useState<PresenceUser | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

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
        color: getUserColor(user.id),
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
      if (typingTimeout) {
        clearTimeout(typingTimeout);
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

  const startTyping = (fieldName: string) => {
    if (channel && currentUser) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Update presence to show typing
      channel.track({
        ...currentUser,
        isTyping: true,
        typingInField: fieldName,
        currentField: fieldName,
        lastSeen: new Date().toISOString(),
      });

      // Auto-stop typing after 2 seconds of inactivity
      const timeout = setTimeout(() => {
        stopTyping();
      }, 2000);
      
      setTypingTimeout(timeout);
    }
  };

  const stopTyping = () => {
    if (channel && currentUser) {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }

      channel.track({
        ...currentUser,
        isTyping: false,
        typingInField: undefined,
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
    startTyping,
    stopTyping,
  };
}
