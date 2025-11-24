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
      console.log('App ready for offline use');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefreshState) {
      setNeedRefresh(true);
      
      // Detect device and browser
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent);
      const isFirefox = /Firefox/.test(navigator.userAgent);
      const isEdge = /Edg/.test(navigator.userAgent);
      
      let instructions = "Refresh your browser to load the latest version.";
      
      if (isIOS && isSafari) {
        instructions = "Tap and hold the refresh button, then select 'Reload Without Content Blockers' or press Cmd+R on keyboard.";
      } else if (isChrome || isEdge) {
        instructions = "Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) to hard refresh.";
      } else if (isFirefox) {
        instructions = "Press Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac) to hard refresh.";
      }
      
      toast("Update Available", {
        description: instructions,
        duration: 10000,
        action: {
          label: "Update Now",
          onClick: () => {
            updateServiceWorker(true);
            setNeedRefreshState(false);
          }
        }
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
