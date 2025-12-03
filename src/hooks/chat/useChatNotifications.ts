import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Hook for channel-specific notifications (used in ChatChannelView).
 * This hook only handles invalidating queries when messages arrive for the active channel.
 * Global notifications (sounds, toasts) are handled by GlobalChatNotifications component.
 */
export function useChatNotifications(activeChannelId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // If no active channel, do nothing - global notifications handle the rest
    if (!activeChannelId) return;

    let mounted = true;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Subscribe to messages for the active channel only
      const channel = supabase
        .channel(`chat-channel-${activeChannelId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `channel_id=eq.${activeChannelId}`,
          },
          async () => {
            // Just invalidate queries - let GlobalChatNotifications handle sounds/toasts
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
  }, [activeChannelId, queryClient]);
}

export function useNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied" as NotificationPermission;
  }
  return Notification.permission;
}
