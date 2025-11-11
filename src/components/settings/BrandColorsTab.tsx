import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, RotateCcw } from "lucide-react";

interface BrandColor {
  id: string;
  color_key: string;
  color_value: string;
}

interface ColorConfig {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
}

const DEFAULT_COLORS: ColorConfig[] = [
  { key: "primary", label: "Primary Color", description: "Main brand color (buttons, links)", defaultValue: "21 63% 53%" },
  { key: "primary-hover", label: "Primary Hover", description: "Primary color on hover", defaultValue: "21 63% 48%" },
  { key: "secondary", label: "Secondary Color", description: "Secondary accent color", defaultValue: "69 36% 58%" },
  { key: "secondary-hover", label: "Secondary Hover", description: "Secondary color on hover", defaultValue: "69 36% 53%" },
  { key: "accent", label: "Accent Color", description: "Accent highlights", defaultValue: "34 90% 77%" },
  { key: "foreground", label: "Text Color", description: "Main text color", defaultValue: "200 5% 19%" },
  { key: "sidebar-background", label: "Sidebar Background", description: "Navigation sidebar background", defaultValue: "200 5% 19%" },
  { key: "sidebar-primary", label: "Sidebar Primary", description: "Active items in sidebar", defaultValue: "21 63% 53%" },
  { key: "sidebar-accent", label: "Sidebar Accent", description: "Hover state in sidebar", defaultValue: "18 16% 32%" },
];

export default function BrandColorsTab() {
  const [colors, setColors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: brandColors = [] } = useQuery({
    queryKey: ["brand-colors"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase
        .from("brand_colors")
        .select("*")
        .eq("tenant_id", profile?.tenant_id);

      if (error) throw error;
      return data as BrandColor[];
    },
  });

  useEffect(() => {
    const colorMap: Record<string, string> = {};
    DEFAULT_COLORS.forEach(config => {
      const savedColor = brandColors.find(c => c.color_key === config.key);
      colorMap[config.key] = savedColor?.color_value || config.defaultValue;
    });
    setColors(colorMap);
  }, [brandColors]);

  const updateColors = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Upsert all colors
      const upsertPromises = Object.entries(colors).map(([key, value]) =>
        supabase
          .from("brand_colors")
          .upsert(
            {
              tenant_id: profile.tenant_id,
              color_key: key,
              color_value: value,
            },
            { onConflict: "tenant_id,color_key" }
          )
      );

      const results = await Promise.all(upsertPromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      // Apply colors to CSS variables
      applyColorsToDOM();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-colors"] });
      toast.success("Brand colors updated successfully");
    },
    onError: () => {
      toast.error("Failed to update brand colors");
    },
  });

  const resetToDefaults = () => {
    const defaultColorMap: Record<string, string> = {};
    DEFAULT_COLORS.forEach(config => {
      defaultColorMap[config.key] = config.defaultValue;
    });
    setColors(defaultColorMap);
    toast.info("Colors reset to defaults. Click Save to apply.");
  };

  const applyColorsToDOM = () => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  };

  const handleColorChange = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const hslToHex = (hsl: string): string => {
    const [h, s, l] = hsl.split(/\s+/).map(v => parseFloat(v.replace('%', '')));
    const hDecimal = h / 360;
    const sDecimal = s / 100;
    const lDecimal = l / 100;

    const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
    const x = c * (1 - Math.abs(((hDecimal * 6) % 2) - 1));
    const m = lDecimal - c / 2;

    let r = 0, g = 0, b = 0;
    if (hDecimal < 1/6) { r = c; g = x; b = 0; }
    else if (hDecimal < 2/6) { r = x; g = c; b = 0; }
    else if (hDecimal < 3/6) { r = 0; g = c; b = x; }
    else if (hDecimal < 4/6) { r = 0; g = x; b = c; }
    else if (hDecimal < 5/6) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToHSL = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0 0% 0%";

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

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

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brand Color Management
              </CardTitle>
              <CardDescription>
                Customize your brand colors. Colors use HSL format (Hue Saturation Lightness).
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetToDefaults}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Premrest Colors
              </Button>
              <Button onClick={() => updateColors.mutate()}>
                Save Colors
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DEFAULT_COLORS.map((config) => (
              <div key={config.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={config.key}>{config.label}</Label>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-border shadow-sm"
                    style={{ backgroundColor: `hsl(${colors[config.key] || config.defaultValue})` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    id={config.key}
                    value={colors[config.key] || config.defaultValue}
                    onChange={(e) => handleColorChange(config.key, e.target.value)}
                    placeholder="e.g., 21 63% 53%"
                    className="font-mono text-sm"
                  />
                  <Input
                    type="color"
                    value={hslToHex(colors[config.key] || config.defaultValue)}
                    onChange={(e) => handleColorChange(config.key, hexToHSL(e.target.value))}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Color Preview</h4>
            <div className="flex flex-wrap gap-2">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
