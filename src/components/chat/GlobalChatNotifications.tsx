import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Preload audio
let notificationAudio: HTMLAudioElement | null = null;
if (typeof window !== "undefined") {
  notificationAudio = new Audio("/sounds/notification.mp3");
  notificationAudio.preload = "auto";
}

// Get settings from localStorage
function getChatSettings() {
  if (typeof window === "undefined") return { soundEnabled: true, desktopNotifications: true };
  try {
    const stored = localStorage.getItem("chat-settings");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // Ignore
  }
  return { soundEnabled: true, desktopNotifications: true };
}

/**
 * Global chat notifications component that listens for all chat messages
 * and plays sounds/shows notifications when the user is not viewing that channel.
 */
export function GlobalChatNotifications() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const lastNotificationTime = useRef<number>(0);
  const debounceMs = 3000;

  // Determine if we're in worker app context
  const isWorkerApp = location.pathname.startsWith("/worker");

  // Get the currently active channel from the URL
  const getActiveChannelId = useCallback(() => {
    const chatMatch = location.pathname.match(/\/chat\/([^/]+)/);
    const workerChatMatch = location.pathname.match(/\/worker\/chat\/([^/]+)/);
    return workerChatMatch?.[1] || chatMatch?.[1] || null;
  }, [location.pathname]);

  const playNotificationSound = useCallback(() => {
    const settings = getChatSettings();
    if (!settings.soundEnabled) return;

    const now = Date.now();
    if (now - lastNotificationTime.current < debounceMs) {
      return;
    }
    lastNotificationTime.current = now;

    if (notificationAudio) {
      notificationAudio.currentTime = 0;
      notificationAudio.play().catch((err) => {
        console.log("[Chat] Could not play notification sound:", err);
      });
    }
  }, []);

  const showSystemNotification = useCallback(
    (title: string, body: string, channelId: string) => {
      const settings = getChatSettings();
      if (!settings.desktopNotifications) return;
      if (Notification.permission !== "granted") return;

      const activeChannelId = getActiveChannelId();
      if (document.hasFocus() && activeChannelId === channelId) return;

      const chatUrl = isWorkerApp ? `/worker/chat/${channelId}` : `/chat/${channelId}`;

      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `chat-notification-${Date.now()}`,
      });

      notification.onclick = () => {
        window.focus();
        navigate(chatUrl);
        notification.close();
      };
    },
    [getActiveChannelId, isWorkerApp, navigate]
  );

  useEffect(() => {
    let mounted = true;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const channel = supabase
        .channel("global-chat-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
          },
          async (payload) => {
            const newMessage = payload.new as {
              id: string;
              channel_id: string;
              user_id: string;
              content: string;
            };

            // Don't notify for own messages
            if (newMessage.user_id === user.id) return;

            // Don't notify if user is viewing this channel and window is focused
            const activeChannelId = getActiveChannelId();
            if (activeChannelId === newMessage.channel_id && document.hasFocus()) {
              return;
            }

            // Check if user is a member of this channel
            const { data: membership } = await supabase
              .from("chat_channel_members")
              .select("channel_id")
              .eq("channel_id", newMessage.channel_id)
              .eq("user_id", user.id)
              .single();

            if (!membership) return;

            // Get sender info
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", newMessage.user_id)
              .single();

            const senderName = senderProfile
              ? `${senderProfile.first_name || ""} ${senderProfile.last_name || ""}`.trim() || "Someone"
              : "Someone";

            // Play sound
            playNotificationSound();

            // Determine correct chat URL
            const chatUrl = isWorkerApp 
              ? `/worker/chat/${newMessage.channel_id}` 
              : `/chat/${newMessage.channel_id}`;

            // Show toast
            toast(`New message from ${senderName}`, {
              description: newMessage.content.substring(0, 50) + (newMessage.content.length > 50 ? "..." : ""),
              action: {
                label: "View",
                onClick: () => {
                  navigate(chatUrl);
                },
              },
            });

            // Show system notification
            showSystemNotification(
              `New message from ${senderName}`,
              newMessage.content.substring(0, 100),
              newMessage.channel_id
            );

            // Invalidate unread counts
            queryClient.invalidateQueries({ queryKey: ["chat-unread-counts"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupSubscription();

    return () => {
      mounted = false;
      cleanup.then((unsubscribe) => unsubscribe?.());
    };
  }, [getActiveChannelId, isWorkerApp, playNotificationSound, showSystemNotification, queryClient, navigate]);

  // This component doesn't render anything
  return null;
}
