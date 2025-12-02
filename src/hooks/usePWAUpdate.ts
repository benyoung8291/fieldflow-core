import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

export const usePWAUpdate = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const isDev = import.meta.env.DEV;
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register service worker with proper callbacks
  useEffect(() => {
    if (isDev || !('serviceWorker' in navigator)) return;
    
    import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('New content available, please refresh');
          setNeedRefresh(true);
          
          // Show user-friendly update notification
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
              onClick: () => clearCacheAndReload()
            }
          });
        },
        onOfflineReady() {
          console.log('App ready for offline use');
        },
        onRegisteredSW(swUrl, registration) {
          console.log('SW registered:', swUrl);
          if (registration) {
            registrationRef.current = registration;
            // Check for updates on initial registration
            registration.update();
          }
        },
      });
      updateSWRef.current = updateSW;
    }).catch(() => {
      console.warn('PWA not available');
    });
  }, [isDev]);

  // Periodic update checks (every 5 minutes)
  useEffect(() => {
    if (isDev) return;
    
    const interval = setInterval(() => {
      checkForUpdates();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [isDev]);

  // Check for updates on visibility change
  useEffect(() => {
    if (isDev) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isDev]);

  const checkForUpdates = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }
  };

  const applyUpdate = () => {
    if (updateSWRef.current) {
      updateSWRef.current(true);
    }
    setNeedRefresh(false);
  };

  const clearCacheAndReload = async () => {
    try {
      console.log('Starting app update process...');
      toast.info('Updating app...', { duration: 2000 });
      
      // Signal the waiting service worker to skip waiting
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          // Wait for the new service worker to take control
          await new Promise<void>((resolve) => {
            const onControllerChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
              resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
            // Timeout after 3 seconds if controller doesn't change
            setTimeout(resolve, 3000);
          });
        }
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log(`Clearing ${cacheNames.length} caches`);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Force reload bypassing cache
      console.log('Reloading app...');
      window.location.reload();
    } catch (error) {
      console.error('Update failed:', error);
      // Fallback: hard reload
      window.location.href = window.location.href;
    }
  };

  return {
    needRefresh,
    checkForUpdates,
    applyUpdate,
    clearCacheAndReload,
  };
};
