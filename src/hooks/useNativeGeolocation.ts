import { useState, useCallback, useEffect } from 'react';
import { Geolocation, Position, PermissionStatus } from '@capacitor/geolocation';
import { isNativeApp, isPluginAvailable } from '@/lib/capacitor';

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface UseGeolocationResult {
  getCurrentPosition: (options?: GeolocationOptions) => Promise<LocationResult | null>;
  watchPosition: (callback: (position: LocationResult) => void, options?: GeolocationOptions) => Promise<string | null>;
  clearWatch: (watchId: string) => Promise<void>;
  checkPermissions: () => Promise<PermissionStatus>;
  requestPermissions: () => Promise<PermissionStatus>;
  isNative: boolean;
  isAvailable: boolean;
  error: string | null;
  loading: boolean;
}

export const useNativeGeolocation = (): UseGeolocationResult => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isNative = isNativeApp();
  const isAvailable = isPluginAvailable('Geolocation');

  const getCurrentPosition = useCallback(async (options?: GeolocationOptions): Promise<LocationResult | null> => {
    setError(null);
    setLoading(true);

    try {
      let position: Position;

      if (isNative && isAvailable) {
        // Use native Capacitor geolocation
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        });
      } else {
        // Fall back to web Geolocation API
        position = await new Promise<Position>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  altitude: pos.coords.altitude,
                  altitudeAccuracy: pos.coords.altitudeAccuracy,
                  heading: pos.coords.heading,
                  speed: pos.coords.speed,
                },
                timestamp: pos.timestamp,
              });
            },
            reject,
            {
              enableHighAccuracy: options?.enableHighAccuracy ?? true,
              timeout: options?.timeout ?? 10000,
              maximumAge: options?.maximumAge ?? 0,
            }
          );
        });
      }

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get location';
      setError(errorMessage);
      console.error('Geolocation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isNative, isAvailable]);

  const watchPosition = useCallback(async (
    callback: (position: LocationResult) => void,
    options?: GeolocationOptions
  ): Promise<string | null> => {
    setError(null);

    try {
      if (isNative && isAvailable) {
        const watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 10000,
            maximumAge: options?.maximumAge ?? 0,
          },
          (position, err) => {
            if (err) {
              setError(err.message || 'Watch position error');
              return;
            }
            if (position) {
              callback({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              });
            }
          }
        );
        return watchId;
      } else {
        // Fall back to web Geolocation API
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            callback({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            });
          },
          (err) => {
            setError(err.message || 'Watch position error');
          },
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 10000,
            maximumAge: options?.maximumAge ?? 0,
          }
        );
        return String(watchId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to watch position');
      return null;
    }
  }, [isNative, isAvailable]);

  const clearWatch = useCallback(async (watchId: string): Promise<void> => {
    try {
      if (isNative && isAvailable) {
        await Geolocation.clearWatch({ id: watchId });
      } else {
        navigator.geolocation.clearWatch(parseInt(watchId, 10));
      }
    } catch (err) {
      console.error('Failed to clear watch:', err);
    }
  }, [isNative, isAvailable]);

  const checkPermissions = useCallback(async (): Promise<PermissionStatus> => {
    if (isNative && isAvailable) {
      return Geolocation.checkPermissions();
    }
    // For web, return a mock permission status based on navigator.permissions
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return {
        location: result.state as 'granted' | 'denied' | 'prompt',
        coarseLocation: result.state as 'granted' | 'denied' | 'prompt',
      };
    } catch {
      return { location: 'prompt', coarseLocation: 'prompt' };
    }
  }, [isNative, isAvailable]);

  const requestPermissions = useCallback(async (): Promise<PermissionStatus> => {
    if (isNative && isAvailable) {
      return Geolocation.requestPermissions();
    }
    // For web, requesting permissions triggers the browser prompt via getCurrentPosition
    return checkPermissions();
  }, [isNative, isAvailable, checkPermissions]);

  return {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    checkPermissions,
    requestPermissions,
    isNative,
    isAvailable: isNative ? isAvailable : 'geolocation' in navigator,
    error,
    loading,
  };
};

/**
 * Calculate distance between two coordinates in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};
