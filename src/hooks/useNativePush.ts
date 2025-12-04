import { useState, useCallback, useEffect } from 'react';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { isNativeApp, isPluginAvailable } from '@/lib/capacitor';

type PermissionStatusType = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | null;

interface UsePushNotificationsResult {
  register: () => Promise<void>;
  getDeliveredNotifications: () => Promise<PushNotificationSchema[]>;
  removeDeliveredNotifications: (ids: string[]) => Promise<void>;
  removeAllDeliveredNotifications: () => Promise<void>;
  token: string | null;
  isNative: boolean;
  isAvailable: boolean;
  error: string | null;
  permissionStatus: PermissionStatusType;
}

export const useNativePush = (): UsePushNotificationsResult => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatusType>(null);
  
  const isNative = isNativeApp();
  const isAvailable = isPluginAvailable('PushNotifications');

  useEffect(() => {
    if (!isNative || !isAvailable) return;

    // Listen for registration success
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setToken(token.value);
    });

    // Listen for registration errors
    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
      setError(err.error || 'Registration failed');
    });

    // Listen for push notifications received while app is in foreground
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      // Dispatch custom event for app to handle
      window.dispatchEvent(new CustomEvent('pushNotificationReceived', { detail: notification }));
    });

    // Listen for push notification actions (taps)
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push action performed:', action);
      // Dispatch custom event for app to handle navigation
      window.dispatchEvent(new CustomEvent('pushNotificationAction', { detail: action }));
    });

    // Check current permission status
    PushNotifications.checkPermissions().then((status) => {
      setPermissionStatus(status.receive);
    });

    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      receivedListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isNative, isAvailable]);

  const register = useCallback(async (): Promise<void> => {
    setError(null);

    if (!isNative || !isAvailable) {
      // For web, try to use web push if supported
      if ('Notification' in window && 'serviceWorker' in navigator) {
        try {
          const permission = await Notification.requestPermission();
          setPermissionStatus(permission as 'granted' | 'denied' | 'prompt');
          if (permission !== 'granted') {
            setError('Web notifications permission denied');
          }
        } catch (err: any) {
          setError(err.message || 'Failed to request web notification permission');
        }
      } else {
        setError('Push notifications not supported on this device');
      }
      return;
    }

    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      setPermissionStatus(permStatus.receive);

      if (permStatus.receive !== 'granted') {
        setError('Push notification permission denied');
        return;
      }

      // Register for push notifications
      await PushNotifications.register();
    } catch (err: any) {
      setError(err.message || 'Failed to register for push notifications');
      console.error('Push registration error:', err);
    }
  }, [isNative, isAvailable]);

  const getDeliveredNotifications = useCallback(async (): Promise<PushNotificationSchema[]> => {
    if (!isNative || !isAvailable) return [];

    try {
      const result = await PushNotifications.getDeliveredNotifications();
      return result.notifications;
    } catch (err) {
      console.error('Failed to get delivered notifications:', err);
      return [];
    }
  }, [isNative, isAvailable]);

  const removeDeliveredNotifications = useCallback(async (ids: string[]): Promise<void> => {
    if (!isNative || !isAvailable) return;

    try {
      // Get delivered notifications and filter by ids
      const delivered = await PushNotifications.getDeliveredNotifications();
      const toRemove = delivered.notifications.filter(n => ids.includes(n.id));
      if (toRemove.length > 0) {
        await PushNotifications.removeDeliveredNotifications({ notifications: toRemove });
      }
    } catch (err) {
      console.error('Failed to remove notifications:', err);
    }
  }, [isNative, isAvailable]);

  const removeAllDeliveredNotifications = useCallback(async (): Promise<void> => {
    if (!isNative || !isAvailable) return;

    try {
      await PushNotifications.removeAllDeliveredNotifications();
    } catch (err) {
      console.error('Failed to remove all notifications:', err);
    }
  }, [isNative, isAvailable]);

  return {
    register,
    getDeliveredNotifications,
    removeDeliveredNotifications,
    removeAllDeliveredNotifications,
    token,
    isNative,
    isAvailable: isNative && isAvailable,
    error,
    permissionStatus,
  };
};
