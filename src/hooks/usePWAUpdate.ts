import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export const usePWAUpdate = () => {
  const [needRefresh, setNeedRefresh] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefreshState, setNeedRefreshState],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('SW Registered:', registration);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('App ready to work offline', {
        duration: 3000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefreshState) {
      setNeedRefresh(true);
      
      // Show update toast with action button
      toast.info('New version available!', {
        description: 'Click to update and get the latest features',
        duration: Infinity, // Keep visible until action taken
        action: {
          label: 'Update Now',
          onClick: () => {
            updateServiceWorker(true);
            setNeedRefresh(false);
            setNeedRefreshState(false);
          },
        },
      });
    }
  }, [needRefreshState, setNeedRefreshState, updateServiceWorker]);

  const checkForUpdates = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }
  };

  const applyUpdate = () => {
    updateServiceWorker(true);
    setNeedRefresh(false);
    setNeedRefreshState(false);
  };

  return {
    needRefresh,
    checkForUpdates,
    applyUpdate,
  };
};
