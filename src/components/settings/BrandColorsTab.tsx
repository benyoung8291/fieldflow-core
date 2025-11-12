import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Plus, Trash2, RotateCcw } from "lucide-react";
import { applyBrandColorsToDom } from "@/hooks/useBrandColors";

interface BrandColor {
  id: string;
  color_key: string;
  color_value: string;
  color_group: string | null;
  display_order: number;
}

export default function BrandColorsTab() {
  const [colorGroups, setColorGroups] = useState<Record<string, string[]>>({
    primary: [],
    secondary: [],
    system: [],
  });
  const [systemColors, setSystemColors] = useState<Record<string, string>>({
    primary: '#d1703c',
    secondary: '#aeba6c',
    accent: '#f9cb8f',
    success: '#16a34a',
    warning: '#f59e0b',
    error: '#dc2626',
    info: '#0ea5e9',
  });
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session?.user?.id)
        .single();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: brandColors = [], isLoading } = useQuery({
    queryKey: ["brand-colors"],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from("brand_colors")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("display_order");

      if (error) throw error;
      return (data || []) as BrandColor[];
    },
    enabled: !!profile?.tenant_id,
  });

  useEffect(() => {
    const groups: Record<string, string[]> = {
      primary: [],
      secondary: [],
    };
    const sysColors: Record<string, string> = {};

    brandColors.forEach((color) => {
      if (color.color_group === 'system') {
        sysColors[color.color_key] = color.color_value;
      } else {
        const group = color.color_group || "primary";
        if (!groups[group]) groups[group] = [];
        groups[group].push(color.color_value);
      }
    });

    // Set defaults if empty
    if (groups.primary.length === 0) {
      groups.primary = ["#2e3133", "#d1703c", "#f9cb8f"];
    }
    if (groups.secondary.length === 0) {
      groups.secondary = ["#aac9db", "#aeba6c", "#e2e2e6", "#604d45", "#aa7533"];
    }
    if (Object.keys(sysColors).length > 0) {
      setSystemColors({ ...systemColors, ...sysColors });
    }

    setColorGroups(groups);
  }, [brandColors]);

  const initializeColors = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { error } = await supabase.rpc('initialize_brand_colors', {
        p_tenant_id: profile.tenant_id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-colors"] });
      toast.success("Brand colours initialized with defaults");
    },
    onError: (error: any) => {
      toast.error("Failed to initialize colours: " + error.message);
    },
  });

  const saveColors = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Delete existing colors
      await supabase
        .from("brand_colors")
        .delete()
        .eq("tenant_id", profile.tenant_id);

      // Insert new colors
      const colorsToInsert: any[] = [];
      
      // Add palette colors
      Object.entries(colorGroups).forEach(([groupName, colors]) => {
        colors.forEach((color, index) => {
          colorsToInsert.push({
            tenant_id: profile.tenant_id,
            color_key: `${groupName}-${index + 1}`,
            color_value: color,
            color_group: groupName,
            display_order: index,
          });
        });
      });

      // Add system colors
      Object.entries(systemColors).forEach(([key, value], index) => {
        colorsToInsert.push({
          tenant_id: profile.tenant_id,
          color_key: key,
          color_value: value,
          color_group: 'system',
          display_order: index,
        });
      });

      if (colorsToInsert.length > 0) {
        const { error } = await supabase.from("brand_colors").insert(colorsToInsert);
        if (error) throw error;
      }

      // Apply colors immediately
      applyBrandColorsToDom(colorsToInsert);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-colors"] });
      toast.success("Brand colours saved successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to save brand colours: " + error.message);
    },
  });

  const addColor = (group: string) => {
    setColorGroups((prev) => ({
      ...prev,
      [group]: [...prev[group], "#000000"],
    }));
  };

  const removeColor = (group: string, index: number) => {
    setColorGroups((prev) => ({
      ...prev,
      [group]: prev[group].filter((_, i) => i !== index),
    }));
  };

  const updateColor = (group: string, index: number, value: string) => {
    setColorGroups((prev) => ({
      ...prev,
      [group]: prev[group].map((c, i) => (i === index ? value : c)),
    }));
  };

  const updateSystemColor = (key: string, value: string) => {
    setSystemColors((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brand Colour Management
              </CardTitle>
              <CardDescription>
                Manage all colours used throughout the application. All UI elements reference these colours.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => initializeColors.mutate()}
                disabled={initializeColors.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button onClick={() => saveColors.mutate()} disabled={saveColors.isPending}>
                {saveColors.isPending ? "Saving..." : "Save Colours"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Primary Brand Colors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Premrest Primary Colours</h3>
                <p className="text-sm text-muted-foreground">Used in menu icons, brand elements</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addColor("primary")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Colour
              </Button>
            </div>
            <div className="flex gap-4 flex-wrap">
              {colorGroups.primary.map((color, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div className="relative group">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => updateColor("primary", index, e.target.value)}
                      className="h-24 w-24 rounded-full cursor-pointer border-4 border-border"
                    />
                    {colorGroups.primary.length > 1 && (
                      <button
                        onClick={() => removeColor("primary", index)}
                        className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => updateColor("primary", index, e.target.value)}
                    className="text-center text-sm font-mono bg-background border rounded px-2 py-1 w-24"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Secondary Brand Colors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Premrest Secondary Colours</h3>
                <p className="text-sm text-muted-foreground">Used in menu icons, accent elements</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addColor("secondary")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Colour
              </Button>
            </div>
            <div className="flex gap-4 flex-wrap">
              {colorGroups.secondary.map((color, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div className="relative group">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => updateColor("secondary", index, e.target.value)}
                      className="h-24 w-24 rounded-full cursor-pointer border-4 border-border"
                    />
                    {colorGroups.secondary.length > 1 && (
                      <button
                        onClick={() => removeColor("secondary", index)}
                        className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => updateColor("secondary", index, e.target.value)}
                    className="text-center text-sm font-mono bg-background border rounded px-2 py-1 w-24"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* System/Functional Colours */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">System Colours</h3>
              <p className="text-sm text-muted-foreground">
                These colours are applied to buttons, alerts, and UI components throughout the app
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {Object.entries(systemColors).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-3">
                  <label className="text-sm font-medium capitalize">{key}</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => updateSystemColor(key, e.target.value)}
                      className="h-20 w-full rounded-lg cursor-pointer border-2 border-border"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateSystemColor(key, e.target.value)}
                      className="text-center text-xs font-mono bg-background border rounded px-2 py-1.5 w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
