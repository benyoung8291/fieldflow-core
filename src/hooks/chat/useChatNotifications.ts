import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.log("[Chat] Notifications not supported");
    return Promise.resolve("denied" as NotificationPermission);
  }

  if (Notification.permission === "granted") {
    return Promise.resolve("granted");
  }

  return Notification.requestPermission();
}

export function useChatNotifications(activeChannelId?: string) {
  const queryClient = useQueryClient();
  const lastNotificationTime = useRef<number>(0);
  const debounceMs = 3000; // 3 second debounce to prevent notification spam

  const playNotificationSound = useCallback(() => {
    const settings = getChatSettings();
    if (!settings.soundEnabled) return;

    const now = Date.now();
    if (now - lastNotificationTime.current < debounceMs) {
      return; // Debounce
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
    (title: string, body: string, channelId?: string) => {
      const settings = getChatSettings();
      if (!settings.desktopNotifications) return;
      if (Notification.permission !== "granted") return;
      if (document.hasFocus() && activeChannelId === channelId) return;

      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `chat-notification-${Date.now()}`,
      });

      notification.onclick = () => {
        window.focus();
        if (channelId) {
          window.location.href = `/chat/${channelId}`;
        }
        notification.close();
      };
    },
    [activeChannelId]
  );

  useEffect(() => {
    let mounted = true;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Subscribe to new messages in all channels the user is a member of
      const channel = supabase
        .channel("chat-notifications")
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

            // Don't notify if user is viewing this channel
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

            // Show toast
            toast(`New message from ${senderName}`, {
              description: newMessage.content.substring(0, 50) + (newMessage.content.length > 50 ? "..." : ""),
              action: {
                label: "View",
                onClick: () => {
                  window.location.href = `/chat/${newMessage.channel_id}`;
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
  }, [activeChannelId, playNotificationSound, showSystemNotification, queryClient]);
}

export function useNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied" as NotificationPermission;
  }
  return Notification.permission;
}
