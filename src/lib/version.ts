// Declare the global injected by Vite at build time
declare const __BUILD_TIMESTAMP__: string;

// Build timestamp injected at compile time - automatically updates with each build
export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' 
  ? __BUILD_TIMESTAMP__ 
  : 'development';

// Backwards compatibility alias - displays formatted timestamp
export const APP_VERSION = BUILD_TIMESTAMP;

// Version storage key for localStorage
export const VERSION_STORAGE_KEY = "app_build_timestamp";

// Get stored version from localStorage
export const getStoredVersion = (): string | null => {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Store current version in localStorage
export const storeVersion = (version: string): void => {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    console.warn('Failed to store version in localStorage');
  }
};

// Format build timestamp for display (e.g., "Dec 9, 2024 12:34 PM")
export const formatBuildTimestamp = (timestamp: string): string => {
  if (!timestamp || timestamp === 'development' || timestamp === 'unknown') {
    return 'Development';
  }
  
  try {
    // Parse YYYYMMDDHHMMSS format
    const year = parseInt(timestamp.slice(0, 4), 10);
    const month = parseInt(timestamp.slice(4, 6), 10) - 1;
    const day = parseInt(timestamp.slice(6, 8), 10);
    const hour = parseInt(timestamp.slice(8, 10), 10);
    const minute = parseInt(timestamp.slice(10, 12), 10);
    
    const date = new Date(Date.UTC(year, month, day, hour, minute));
    
    return date.toLocaleDateString('en-AU', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Australia/Melbourne'
    });
  } catch {
    return timestamp;
  }
};

// Compare build timestamps (returns true if serverTimestamp is newer)
export const isNewerBuild = (current: string, server: string): boolean => {
  if (!current || !server) return false;
  if (current === 'development' || server === 'unknown') return false;
  
  // String comparison works for YYYYMMDDHHMMSS format
  return server > current;
};
