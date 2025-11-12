import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface BrandColor {
  id: string;
  color_key: string;
  color_value: string;
  color_group: string | null;
  display_order: number;
}

// Helper to convert hex to HSL
const hexToHSL = (hex: string): string => {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
};

// Apply brand colors to CSS variables
export const applyBrandColorsToDom = (colors: BrandColor[]) => {
  const root = document.documentElement;
  
  // Map color keys to CSS variable names
  const colorMappings: Record<string, string> = {
    'primary': '--primary',
    'secondary': '--secondary',
    'accent': '--accent',
    'success': '--success',
    'warning': '--warning',
    'error': '--destructive',
    'info': '--info',
  };
  
  colors.forEach((color) => {
    const cssVar = colorMappings[color.color_key];
    if (cssVar) {
      // Convert hex to HSL for CSS variables
      const hslValue = hexToHSL(color.color_value);
      root.style.setProperty(cssVar, hslValue);
    }
  });
};

export function useBrandColors() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: brandColors = [], isLoading, refetch } = useQuery({
    queryKey: ["brand-colors"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session?.user?.id)
        .single();

      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("brand_colors")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("display_order");

      if (error) throw error;
      return (data || []) as BrandColor[];
    },
    enabled: !!session?.user?.id,
  });

  // Apply colors to DOM whenever they change
  useEffect(() => {
    if (brandColors.length > 0) {
      applyBrandColorsToDom(brandColors);
    }
  }, [brandColors]);

  return {
    brandColors,
    isLoading,
    refetch,
  };
}
