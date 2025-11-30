import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type PWAHook = {
  offlineReady: [boolean, (value: boolean) => void];
  needRefresh: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void> | void;
};

// Type-safe no-op for development
const noOpPWA: PWAHook = {
  offlineReady: [false, () => {}],
  needRefresh: [false, () => {}],
  updateServiceWorker: () => {},
};

export const usePWAUpdate = () => {
  const [needRefresh, setNeedRefresh] = useState(false);

  // Only use real PWA in production builds
  const isDev = import.meta.env.DEV;
  
  // In development, use no-op. In production, dynamically import
  const [pwaHook, setPwaHook] = useState<PWAHook>(noOpPWA);

  useEffect(() => {
    if (!isDev) {
      // Only load PWA in production
      import('virtual:pwa-register/react').then(({ useRegisterSW }) => {
        const hook = useRegisterSW({
          onRegistered(registration) {
            console.log('SW Registered:', registration);
          },
          onRegisterError(error) {
            console.error('SW registration error:', error);
          },
        });
        setPwaHook(hook as PWAHook);
      }).catch(() => {
        console.warn('PWA not available');
      });
    }
  }, [isDev]);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefreshState, setNeedRefreshState],
    updateServiceWorker,
  } = pwaHook;

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

  const clearCacheAndReload = async () => {
    try {
      console.log('Starting app update process...');
      toast.info('Updating app...', { duration: 2000 });
      
      // Check if there's a new service worker waiting
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          console.log('Service Worker registration:', registration ? 'Found' : 'Not found');
          
          // Check for updates first
          if (registration) {
            console.log('Checking for SW updates...');
            await registration.update();
            console.log('SW update check complete');
          }
        } catch (swError) {
          console.warn('Service Worker update failed, continuing anyway:', swError);
        }
      }
      
      // Clear all caches to ensure fresh content
      if ('caches' in window) {
        try {
          console.log('Clearing caches...');
          const cacheNames = await caches.keys();
          console.log(`Found ${cacheNames.length} caches to clear`);
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('Caches cleared successfully');
        } catch (cacheError) {
          console.warn('Cache clearing failed, continuing anyway:', cacheError);
        }
      }

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      // Force reload from server
      console.log('Reloading app...');
      window.location.reload();
    } catch (error) {
      console.error('Critical error updating app:', error);
      toast.error('Failed to update app. Please refresh manually.');
    }
  };

  return {
    needRefresh,
    checkForUpdates,
    applyUpdate,
    clearCacheAndReload,
  };
};
