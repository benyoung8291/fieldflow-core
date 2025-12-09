import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION, isNewerVersion, storeVersion } from '@/lib/version';

export const usePWAUpdate = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [currentVersion] = useState(APP_VERSION);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const isDev = import.meta.env.DEV;
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const dismissedAtRef = useRef<number | null>(null);

  // Check version from edge function
  const checkServerVersion = useCallback(async () => {
    if (isDev) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-app-version');
      
      if (error) {
        console.warn('Failed to check server version:', error);
        return;
      }
      
      if (data?.version) {
        setLatestVersion(data.version);
        
        if (isNewerVersion(currentVersion, data.version)) {
          console.log(`New version available: ${data.version} (current: ${currentVersion})`);
          setNeedRefresh(true);
        }
      }
    } catch (error) {
      console.warn('Version check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion, isDev]);

  // Register service worker with proper callbacks
  useEffect(() => {
    if (isDev || !('serviceWorker' in navigator)) return;
    
    import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('New content available, please refresh');
          setNeedRefresh(true);
        },
        onOfflineReady() {
          console.log('App ready for offline use');
        },
        onRegisteredSW(swUrl, registration) {
          console.log('SW registered:', swUrl);
          if (registration) {
            registrationRef.current = registration;
            registration.update();
          }
        },
      });
      updateSWRef.current = updateSW;
    }).catch(() => {
      console.warn('PWA not available');
    });
  }, [isDev]);

  // Check server version on mount and periodically
  useEffect(() => {
    if (isDev) return;
    
    // Check immediately on mount
    checkServerVersion();
    
    // Check every 5 minutes
    const interval = setInterval(checkServerVersion, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkServerVersion, isDev]);

  // Check for updates on visibility change
  useEffect(() => {
    if (isDev) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkServerVersion();
        
        // Re-check SW updates
        if (registrationRef.current) {
          registrationRef.current.update();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkServerVersion, isDev]);

  // Re-show banner after 30 minutes if dismissed
  useEffect(() => {
    if (!dismissedAtRef.current || !needRefresh) return;
    
    const checkDismissTimeout = setInterval(() => {
      if (dismissedAtRef.current && Date.now() - dismissedAtRef.current > 30 * 60 * 1000) {
        dismissedAtRef.current = null;
        setNeedRefresh(true);
      }
    }, 60 * 1000); // Check every minute
    
    return () => clearInterval(checkDismissTimeout);
  }, [needRefresh]);

  const temporaryDismiss = useCallback(() => {
    dismissedAtRef.current = Date.now();
    setNeedRefresh(false);
  }, []);

  const clearCacheAndReload = async () => {
    try {
      console.log('Starting comprehensive app update...');
      toast.info('Updating app...', { duration: 2000 });
      
      // 1. Signal waiting service worker to skip waiting
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          await new Promise<void>((resolve) => {
            const onControllerChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
              resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
            setTimeout(resolve, 3000);
          });
        }
        
        // Unregister all service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        console.log(`Unregistered ${registrations.length} service workers`);
      }
      
      // 2. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log(`Clearing ${cacheNames.length} caches`);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // 3. Clear version from localStorage and update to latest
      if (latestVersion) {
        storeVersion(latestVersion);
      }
      
      // 4. Clear any app-specific cached data
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('query-') || key?.startsWith('cache-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.warn('Failed to clear some localStorage items:', e);
      }
      
      // 5. Force hard reload
      console.log('Reloading app...');
      window.location.reload();
    } catch (error) {
      console.error('Update failed:', error);
      // Fallback: force navigation
      window.location.href = window.location.origin + window.location.pathname + '?_=' + Date.now();
    }
  };

  return {
    needRefresh,
    currentVersion,
    latestVersion,
    isChecking,
    checkForUpdates: checkServerVersion,
    temporaryDismiss,
    clearCacheAndReload,
  };
};
