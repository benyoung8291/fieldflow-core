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
  status?: 'available' | 'busy' | 'away';
  lastActivity?: string;
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
  const [activityTimeout, setActivityTimeout] = useState<NodeJS.Timeout | null>(null);
  const [userStatus, setUserStatus] = useState<'available' | 'busy' | 'away'>('available');
  const [autoAwayMinutes, setAutoAwayMinutes] = useState<number>(5);

  useEffect(() => {
    // Get current user info
    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch user's status and auto-away settings from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, auto_away_minutes')
        .eq('id', user.id)
        .single();

      const status = (profile?.status || 'available') as 'available' | 'busy' | 'away';
      const autoAway = profile?.auto_away_minutes || 5;
      
      setUserStatus(status);
      setAutoAwayMinutes(autoAway);

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
        status: status,
        lastActivity: new Date().toISOString(),
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

    // Start activity tracking for auto-away
    const resetActivityTimer = () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Only set auto-away if current status is not manually set to busy
      if (userStatus !== 'busy') {
        const timeout = setTimeout(async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && channel) {
            await supabase
              .from('profiles')
              .update({ status: 'away', status_updated_at: new Date().toISOString() })
              .eq('id', user.id);
            
            setUserStatus('away');
            channel.track({
              ...currentUser,
              status: 'away',
              lastActivity: new Date().toISOString(),
            });
          }
        }, autoAwayMinutes * 60 * 1000);
        
        setActivityTimeout(timeout);
      }
    };

    // Track user activity
    const handleActivity = () => {
      if (channel && currentUser && userStatus === 'away') {
        // Auto-return from away when user is active
        updateStatus('available');
      }
      resetActivityTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    
    resetActivityTimer();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [page, autoAwayMinutes, userStatus]);

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

  const updateStatus = async (newStatus: 'available' | 'busy' | 'away') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && channel && currentUser) {
      // Update in database
      await supabase
        .from('profiles')
        .update({ 
          status: newStatus, 
          status_updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);
      
      // Update local state
      setUserStatus(newStatus);
      
      // Update presence channel
      const updatedUser = {
        ...currentUser,
        status: newStatus,
        lastActivity: new Date().toISOString(),
      };
      
      setCurrentUser(updatedUser);
      channel.track(updatedUser);
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
    updateStatus,
    userStatus,
    autoAwayMinutes,
  };
}
