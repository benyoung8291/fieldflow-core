import { useState, useEffect, useCallback } from 'react';
import { Network, ConnectionStatus, ConnectionType } from '@capacitor/network';
import { isNativeApp, isPluginAvailable } from '@/lib/capacitor';

interface UseNetworkResult {
  isConnected: boolean;
  connectionType: ConnectionType | 'unknown';
  checkStatus: () => Promise<ConnectionStatus>;
  isNative: boolean;
  isAvailable: boolean;
}

export const useNativeNetwork = (): UseNetworkResult => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<ConnectionType | 'unknown'>('unknown');
  const isNative = isNativeApp();
  const isAvailable = isPluginAvailable('Network');

  const checkStatus = useCallback(async (): Promise<ConnectionStatus> => {
    if (isNative && isAvailable) {
      const status = await Network.getStatus();
      setIsConnected(status.connected);
      setConnectionType(status.connectionType);
      return status;
    } else {
      // Use web navigator.onLine
      const connected = navigator.onLine;
      setIsConnected(connected);
      setConnectionType(connected ? 'wifi' : 'none');
      return { connected, connectionType: connected ? 'wifi' : 'none' };
    }
  }, [isNative, isAvailable]);

  useEffect(() => {
    // Initial status check
    checkStatus();

    if (isNative && isAvailable) {
      // Listen for network status changes
      const listener = Network.addListener('networkStatusChange', (status) => {
        console.log('Network status changed:', status);
        setIsConnected(status.connected);
        setConnectionType(status.connectionType);
        
        // Dispatch custom event for app to handle
        window.dispatchEvent(new CustomEvent('networkStatusChange', { 
          detail: { connected: status.connected, connectionType: status.connectionType }
        }));
      });

      return () => {
        listener.then(l => l.remove());
      };
    } else {
      // Web fallback using online/offline events
      const handleOnline = () => {
        setIsConnected(true);
        setConnectionType('wifi');
        window.dispatchEvent(new CustomEvent('networkStatusChange', { 
          detail: { connected: true, connectionType: 'wifi' }
        }));
      };

      const handleOffline = () => {
        setIsConnected(false);
        setConnectionType('none');
        window.dispatchEvent(new CustomEvent('networkStatusChange', { 
          detail: { connected: false, connectionType: 'none' }
        }));
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [isNative, isAvailable, checkStatus]);

  return {
    isConnected,
    connectionType,
    checkStatus,
    isNative,
    isAvailable: isNative ? isAvailable : true, // Web always has basic network detection
  };
};
