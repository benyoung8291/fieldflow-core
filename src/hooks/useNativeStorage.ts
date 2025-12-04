import { useState, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNativeApp, isPluginAvailable, convertFileSrc } from '@/lib/capacitor';

interface UseStorageResult {
  // Key-value storage
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
  
  // File storage
  writeFile: (path: string, data: string | Blob) => Promise<string | null>;
  readFile: (path: string) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  getFileUri: (path: string) => Promise<string | null>;
  
  isNative: boolean;
  error: string | null;
}

export const useNativeStorage = (): UseStorageResult => {
  const [error, setError] = useState<string | null>(null);
  const isNative = isNativeApp();
  const preferencesAvailable = isPluginAvailable('Preferences');
  const filesystemAvailable = isPluginAvailable('Filesystem');

  // Key-value storage methods
  const setItem = useCallback(async (key: string, value: string): Promise<void> => {
    setError(null);
    try {
      if (isNative && preferencesAvailable) {
        await Preferences.set({ key, value });
      } else {
        localStorage.setItem(key, value);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set item');
      console.error('Storage setItem error:', err);
    }
  }, [isNative, preferencesAvailable]);

  const getItem = useCallback(async (key: string): Promise<string | null> => {
    setError(null);
    try {
      if (isNative && preferencesAvailable) {
        const result = await Preferences.get({ key });
        return result.value;
      } else {
        return localStorage.getItem(key);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get item');
      console.error('Storage getItem error:', err);
      return null;
    }
  }, [isNative, preferencesAvailable]);

  const removeItem = useCallback(async (key: string): Promise<void> => {
    setError(null);
    try {
      if (isNative && preferencesAvailable) {
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem(key);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
      console.error('Storage removeItem error:', err);
    }
  }, [isNative, preferencesAvailable]);

  const clear = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      if (isNative && preferencesAvailable) {
        await Preferences.clear();
      } else {
        localStorage.clear();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clear storage');
      console.error('Storage clear error:', err);
    }
  }, [isNative, preferencesAvailable]);

  const keys = useCallback(async (): Promise<string[]> => {
    setError(null);
    try {
      if (isNative && preferencesAvailable) {
        const result = await Preferences.keys();
        return result.keys;
      } else {
        return Object.keys(localStorage);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get keys');
      console.error('Storage keys error:', err);
      return [];
    }
  }, [isNative, preferencesAvailable]);

  // File storage methods
  const writeFile = useCallback(async (path: string, data: string | Blob): Promise<string | null> => {
    setError(null);
    try {
      if (isNative && filesystemAvailable) {
        if (typeof data === 'string') {
          const result = await Filesystem.writeFile({
            path,
            data,
            directory: Directory.Data,
            encoding: Encoding.UTF8,
          });
          return result.uri;
        } else {
          // Convert Blob to base64
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const base64String = reader.result as string;
              resolve(base64String.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(data);
          });
          
          const result = await Filesystem.writeFile({
            path,
            data: base64,
            directory: Directory.Data,
          });
          return result.uri;
        }
      } else {
        // For web, use IndexedDB or just return null
        console.warn('File storage not available on web, use IndexedDB directly');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to write file');
      console.error('Filesystem writeFile error:', err);
      return null;
    }
  }, [isNative, filesystemAvailable]);

  const readFile = useCallback(async (path: string): Promise<string | null> => {
    setError(null);
    try {
      if (isNative && filesystemAvailable) {
        const result = await Filesystem.readFile({
          path,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        return result.data as string;
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      console.error('Filesystem readFile error:', err);
      return null;
    }
  }, [isNative, filesystemAvailable]);

  const deleteFile = useCallback(async (path: string): Promise<void> => {
    setError(null);
    try {
      if (isNative && filesystemAvailable) {
        await Filesystem.deleteFile({
          path,
          directory: Directory.Data,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
      console.error('Filesystem deleteFile error:', err);
    }
  }, [isNative, filesystemAvailable]);

  const getFileUri = useCallback(async (path: string): Promise<string | null> => {
    setError(null);
    try {
      if (isNative && filesystemAvailable) {
        const result = await Filesystem.getUri({
          path,
          directory: Directory.Data,
        });
        return convertFileSrc(result.uri);
      }
      return null;
    } catch (err: any) {
      setError(err.message || 'Failed to get file URI');
      console.error('Filesystem getUri error:', err);
      return null;
    }
  }, [isNative, filesystemAvailable]);

  return {
    setItem,
    getItem,
    removeItem,
    clear,
    keys,
    writeFile,
    readFile,
    deleteFile,
    getFileUri,
    isNative,
    error,
  };
};
