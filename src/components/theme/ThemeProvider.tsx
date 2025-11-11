import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeSyncWrapper>{children}</ThemeSyncWrapper>
    </NextThemesProvider>
  );
}

function ThemeSyncWrapper({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  // Load user's theme preference from profile
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
  });

  // Save theme preference to profile
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

  // Apply saved theme on load
  useEffect(() => {
    if (profile?.theme_preference && profile.theme_preference !== theme) {
      setTheme(profile.theme_preference);
    }
  }, [profile, theme, setTheme]);

  // Save theme changes to profile
  useEffect(() => {
    if (theme && profile) {
      saveTheme(theme);
    }
  }, [theme, profile, saveTheme]);

  return <>{children}</>;
}
