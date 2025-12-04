import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp, isPluginAvailable } from '@/lib/capacitor';

interface UseHapticsResult {
  impact: (style?: ImpactStyle) => Promise<void>;
  notification: (type?: NotificationType) => Promise<void>;
  vibrate: (duration?: number) => Promise<void>;
  selectionStart: () => Promise<void>;
  selectionChanged: () => Promise<void>;
  selectionEnd: () => Promise<void>;
  isNative: boolean;
  isAvailable: boolean;
}

export const useNativeHaptics = (): UseHapticsResult => {
  const isNative = isNativeApp();
  const isAvailable = isPluginAvailable('Haptics');

  const impact = useCallback(async (style: ImpactStyle = ImpactStyle.Medium): Promise<void> => {
    if (!isNative || !isAvailable) {
      // Try web vibration API as fallback
      if ('vibrate' in navigator) {
        navigator.vibrate(style === ImpactStyle.Heavy ? 50 : style === ImpactStyle.Light ? 10 : 25);
      }
      return;
    }

    try {
      await Haptics.impact({ style });
    } catch (err) {
      console.error('Haptics impact error:', err);
    }
  }, [isNative, isAvailable]);

  const notification = useCallback(async (type: NotificationType = NotificationType.Success): Promise<void> => {
    if (!isNative || !isAvailable) {
      if ('vibrate' in navigator) {
        const pattern = type === NotificationType.Error ? [100, 50, 100] : 
                        type === NotificationType.Warning ? [50, 50, 50] : [50];
        navigator.vibrate(pattern);
      }
      return;
    }

    try {
      await Haptics.notification({ type });
    } catch (err) {
      console.error('Haptics notification error:', err);
    }
  }, [isNative, isAvailable]);

  const vibrate = useCallback(async (duration: number = 300): Promise<void> => {
    if (!isNative || !isAvailable) {
      if ('vibrate' in navigator) {
        navigator.vibrate(duration);
      }
      return;
    }

    try {
      await Haptics.vibrate({ duration });
    } catch (err) {
      console.error('Haptics vibrate error:', err);
    }
  }, [isNative, isAvailable]);

  const selectionStart = useCallback(async (): Promise<void> => {
    if (!isNative || !isAvailable) return;

    try {
      await Haptics.selectionStart();
    } catch (err) {
      console.error('Haptics selectionStart error:', err);
    }
  }, [isNative, isAvailable]);

  const selectionChanged = useCallback(async (): Promise<void> => {
    if (!isNative || !isAvailable) return;

    try {
      await Haptics.selectionChanged();
    } catch (err) {
      console.error('Haptics selectionChanged error:', err);
    }
  }, [isNative, isAvailable]);

  const selectionEnd = useCallback(async (): Promise<void> => {
    if (!isNative || !isAvailable) return;

    try {
      await Haptics.selectionEnd();
    } catch (err) {
      console.error('Haptics selectionEnd error:', err);
    }
  }, [isNative, isAvailable]);

  return {
    impact,
    notification,
    vibrate,
    selectionStart,
    selectionChanged,
    selectionEnd,
    isNative,
    isAvailable: isNative && isAvailable,
  };
};
