import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Get initial theme from localStorage immediately to prevent flash
  const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme-preference') || 'light';
    }
    return 'light';
  };

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={getInitialTheme()}
      enableSystem={false}
      storageKey="theme-preference"
      disableTransitionOnChange
    >
      <ThemeSyncWrapper>{children}</ThemeSyncWrapper>
    </NextThemesProvider>
  );
}

function ThemeSyncWrapper({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  // Load user's theme preference from profile (background sync only)
  const { data: profile } = useQuery({
    queryKey: ["profile-theme"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .single();

      return data;
    },
    staleTime: Infinity, // Only fetch once
  });

  // Save theme preference to profile (debounced)
  const { mutate: saveTheme } = useMutation({
    mutationFn: async (newTheme: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({ theme_preference: newTheme })
        .eq("id", user.id);
    },
  });

  // Only sync from DB if different from localStorage (prevents flash)
  useEffect(() => {
    if (profile?.theme_preference && 
        profile.theme_preference !== 'system' && 
        profile.theme_preference !== theme &&
        profile.theme_preference !== localStorage.getItem('theme-preference')) {
      setTheme(profile.theme_preference);
      localStorage.setItem('theme-preference', profile.theme_preference);
    }
  }, [profile]);

  // Save theme changes to profile (background sync)
  useEffect(() => {
    if (theme && profile !== undefined) {
      saveTheme(theme);
    }
  }, [theme]);

  return <>{children}</>;
}
