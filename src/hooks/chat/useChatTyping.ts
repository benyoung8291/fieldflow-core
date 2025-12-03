import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import debounce from "lodash-es/debounce";

interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

interface UseChatTypingReturn {
  typingUsers: TypingUser[];
  broadcastTyping: () => void;
}

const TYPING_TIMEOUT = 3000; // Remove user after 3 seconds of no activity

export function useChatTyping(channelId: string | undefined): UseChatTypingReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Get current user info
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", data.user.id)
          .single();
        
        if (profile) {
          setCurrentUserName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User");
        }
      }
    });
  }, []);

  // Cleanup stale typing users
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((user) => now - user.timestamp < TYPING_TIMEOUT));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to typing events
  useEffect(() => {
    if (!channelId || !currentUserId) return;

    const channel = supabase.channel(`typing:${channelId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, userName } = payload.payload as { userId: string; userName: string };
        
        // Don't show own typing indicator
        if (userId === currentUserId) return;

        setTypingUsers((prev) => {
          const existing = prev.find((u) => u.userId === userId);
          if (existing) {
            return prev.map((u) =>
              u.userId === userId ? { ...u, timestamp: Date.now() } : u
            );
          }
          return [...prev, { userId, userName, timestamp: Date.now() }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelId, currentUserId]);

  // Debounced broadcast function
  const debouncedBroadcast = useCallback(
    debounce(() => {
      if (channelRef.current && currentUserId && currentUserName) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: { userId: currentUserId, userName: currentUserName },
        });
      }
    }, 500),
    [currentUserId, currentUserName]
  );

  const broadcastTyping = useCallback(() => {
    debouncedBroadcast();
  }, [debouncedBroadcast]);

  return { typingUsers, broadcastTyping };
}
