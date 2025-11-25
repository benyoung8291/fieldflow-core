import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type NotificationType = 'mention' | 'task_assigned' | 'task_completed' | 'comment' | 'other';

interface NotificationPreferences {
  enabled: boolean;
  mentions: boolean;
  taskAssignments: boolean;
  taskCompletions: boolean;
  comments: boolean;
  sound: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  mentions: true,
  taskAssignments: true,
  taskCompletions: false,
  comments: true,
  sound: true,
};

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    // Load preferences from localStorage
    const stored = localStorage.getItem('notificationPreferences');
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse notification preferences:', e);
      }
    }

    // Check current permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('Desktop notifications are not supported in this browser');
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Desktop notifications enabled');
        return true;
      } else if (result === 'denied') {
        toast.error('Desktop notifications permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  };

  const updatePreferences = (newPreferences: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    localStorage.setItem('notificationPreferences', JSON.stringify(updated));
  };

  const shouldShowNotification = (type: NotificationType): boolean => {
    if (!preferences.enabled || permission !== 'granted') {
      return false;
    }

    switch (type) {
      case 'mention':
        return preferences.mentions;
      case 'task_assigned':
        return preferences.taskAssignments;
      case 'task_completed':
        return preferences.taskCompletions;
      case 'comment':
        return preferences.comments;
      default:
        return false;
    }
  };

  const showNotification = async (
    title: string,
    options: {
      body: string;
      type: NotificationType;
      icon?: string;
      data?: any;
      onClick?: () => void;
    }
  ) => {
    if (!shouldShowNotification(options.type)) {
      return;
    }

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      const notification = new Notification(title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: options.data?.id || `notification-${Date.now()}`,
        requireInteraction: false,
        data: options.data,
      });

      if (preferences.sound) {
        // Play a subtle notification sound
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRQ0PVKXh8bllHgU7k9nyz38qBSh+zPLaizsIGGS57OihUhELTKXh8LdlIAU1j9Tz0H0pBSt+zPDajDwIGGW77OihUhELTKXh8bZlIQU1j9Tz0H0pBSuAzPDbjDsIG2W57OihUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8rZlIQY1j9Tz0H0pBSuAzPDbjTwIG2W57eeqUhELTKXh8g==');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Silently fail if sound can't play
        });
      }

      if (options.onClick) {
        notification.onclick = () => {
          options.onClick?.();
          notification.close();
          window.focus();
        };
      }

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const notifyMention = async (mentionedBy: string, context: string, onClick?: () => void) => {
    await showNotification(
      `${mentionedBy} mentioned you`,
      {
        body: context,
        type: 'mention',
        onClick,
      }
    );
  };

  const notifyTaskAssigned = async (
    taskTitle: string, 
    assignedBy: string,
    onClick?: () => void
  ) => {
    await showNotification(
      'New Task Assigned',
      {
        body: `${assignedBy} assigned you: ${taskTitle}`,
        type: 'task_assigned',
        onClick,
      }
    );
  };

  const notifyTaskCompleted = async (
    taskTitle: string,
    completedBy: string,
    onClick?: () => void
  ) => {
    await showNotification(
      'Task Completed',
      {
        body: `${completedBy} completed: ${taskTitle}`,
        type: 'task_completed',
        onClick,
      }
    );
  };

  const notifyComment = async (
    commenter: string,
    comment: string,
    onClick?: () => void
  ) => {
    await showNotification(
      `New comment from ${commenter}`,
      {
        body: comment,
        type: 'comment',
        onClick,
      }
    );
  };

  return {
    permission,
    preferences,
    requestPermission,
    updatePreferences,
    showNotification,
    notifyMention,
    notifyTaskAssigned,
    notifyTaskCompleted,
    notifyComment,
  };
}

// Realtime notification listener for database events
export function useRealtimeNotifications() {
  const { notifyTaskAssigned, notifyMention, notifyComment } = useNotifications();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const initNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[Notifications] No user found");
        return;
      }

      console.log("[Notifications] Initializing for user:", user.id);
      setCurrentUserId(user.id);

      // Listen for task assignments
      const tasksChannel = supabase
        .channel('task-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tasks',
            filter: `assigned_to=eq.${user.id}`,
          },
          async (payload) => {
            console.log("[Notifications] Task INSERT:", payload);
            const task = payload.new;
            
            // Fetch task creator info
            const { data: creator } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', task.created_by)
              .single();

            const creatorName = creator 
              ? `${creator.first_name} ${creator.last_name}`.trim()
              : 'Someone';

            notifyTaskAssigned(task.title, creatorName);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tasks',
            filter: `assigned_to=eq.${user.id}`,
          },
          async (payload) => {
            console.log("[Notifications] Task UPDATE:", payload);
            const oldTask = payload.old;
            const newTask = payload.new;

            // Only notify if task was just assigned to this user
            if (oldTask.assigned_to !== user.id && newTask.assigned_to === user.id) {
              const { data: assigner } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', newTask.updated_by || newTask.created_by)
                .single();

              const assignerName = assigner 
                ? `${assigner.first_name} ${assigner.last_name}`.trim()
                : 'Someone';

              notifyTaskAssigned(newTask.title, assignerName);
            }
          }
        )
        .subscribe((status) => {
          console.log("[Notifications] Channel status:", status);
        });

      return () => {
        supabase.removeChannel(tasksChannel);
      };
    };

    initNotifications();
  }, [notifyTaskAssigned, notifyMention, notifyComment]);

  return { currentUserId };
}
