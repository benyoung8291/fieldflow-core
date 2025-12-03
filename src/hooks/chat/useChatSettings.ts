import { useState, useEffect, useCallback } from "react";

interface ChatSettings {
  soundEnabled: boolean;
  desktopNotifications: boolean;
}

const STORAGE_KEY = "chat-settings";

const defaultSettings: ChatSettings = {
  soundEnabled: true,
  desktopNotifications: true,
};

export function useChatSettings() {
  const [settings, setSettings] = useState<ChatSettings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("[Chat] Failed to load settings:", e);
    }
    return defaultSettings;
  });

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("[Chat] Failed to save settings:", e);
    }
  }, [settings]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, soundEnabled: enabled }));
  }, []);

  const setDesktopNotifications = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, desktopNotifications: enabled }));
  }, []);

  const toggleSound = useCallback(() => {
    setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  const toggleDesktopNotifications = useCallback(() => {
    setSettings((prev) => ({ ...prev, desktopNotifications: !prev.desktopNotifications }));
  }, []);

  return {
    ...settings,
    setSoundEnabled,
    setDesktopNotifications,
    toggleSound,
    toggleDesktopNotifications,
  };
}
