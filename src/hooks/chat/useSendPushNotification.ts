import { supabase } from "@/integrations/supabase/client";

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    type?: string;
    channelId?: string;
    isWorkerApp?: boolean;
    url?: string;
  };
}

/**
 * Send push notification to a specific user via edge function
 */
export async function sendPushNotification(
  userId: string, 
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { userId, payload }
    });

    if (error) {
      console.error('[Push] Error sending notification:', error);
      return false;
    }

    console.log('[Push] Notification sent:', data);
    return true;
  } catch (error) {
    console.error('[Push] Error invoking edge function:', error);
    return false;
  }
}

/**
 * Send push notification to all members of a chat channel except the sender
 */
export async function sendChatPushNotification(
  channelId: string,
  senderId: string,
  senderName: string,
  messageContent: string
): Promise<void> {
  try {
    // Get all channel members except sender
    const { data: members, error } = await supabase
      .from('chat_channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .neq('user_id', senderId);

    if (error || !members?.length) {
      return;
    }

    // Determine if this is likely a worker context
    const isWorkerApp = window.location.pathname.startsWith('/worker');

    // Send push to each member
    const payload: PushNotificationPayload = {
      title: `New message from ${senderName}`,
      body: messageContent.substring(0, 100),
      data: {
        type: 'chat',
        channelId,
        isWorkerApp,
      }
    };

    // Send notifications in parallel but don't wait for all
    members.forEach(member => {
      sendPushNotification(member.user_id, payload).catch(err => {
        console.error('[Push] Failed to send to member:', err);
      });
    });
  } catch (error) {
    console.error('[Push] Error sending chat notifications:', error);
  }
}
