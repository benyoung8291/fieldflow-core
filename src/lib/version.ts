// Current client-side version - update this with each deployment
export const APP_VERSION = "1.0.3";

// Version storage key for localStorage
export const VERSION_STORAGE_KEY = "app_version";

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

// Compare versions (returns true if serverVersion is newer)
export const isNewerVersion = (currentVersion: string, serverVersion: string): boolean => {
  if (!currentVersion || !serverVersion) return false;
  
  const current = currentVersion.split('.').map(Number);
  const server = serverVersion.split('.').map(Number);
  
  for (let i = 0; i < Math.max(current.length, server.length); i++) {
    const c = current[i] || 0;
    const s = server[i] || 0;
    if (s > c) return true;
    if (s < c) return false;
  }
  return false;
};
