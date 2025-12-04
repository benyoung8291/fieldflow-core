import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running in a native Capacitor context (iOS/Android)
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

/**
 * Check if a specific plugin is available
 */
export const isPluginAvailable = (pluginName: string): boolean => {
  return Capacitor.isPluginAvailable(pluginName);
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return getPlatform() === 'ios';
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return getPlatform() === 'android';
};

/**
 * Check if running on web (PWA or browser)
 */
export const isWeb = (): boolean => {
  return getPlatform() === 'web';
};

/**
 * Convert a web URL to a native-compatible URL if needed
 */
export const convertFileSrc = (filePath: string): string => {
  return Capacitor.convertFileSrc(filePath);
};
