import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SequentialSetting {
  id: string;
  entity_type: string;
  prefix: string;
  next_number: number;
  number_length: number;
}

export default function NumberingTab() {
  const queryClient = useQueryClient();
  const [overheadPercentage, setOverheadPercentage] = useState<string>("20");
  const [defaultMarginPercentage, setDefaultMarginPercentage] = useState<string>("30");
  const [settings, setSettings] = useState<Record<string, { prefix: string; next_number: number; number_length: number }>>({
    service_order: { prefix: "SO-", next_number: 1, number_length: 6 },
    quote: { prefix: "Q-", next_number: 1, number_length: 6 },
    invoice: { prefix: "INV-", next_number: 1, number_length: 6 },
  });

  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ["sequential-number-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequential_number_settings")
        .select("*");
      
      if (error) throw error;
      
      // Populate settings from database
      const settingsMap: Record<string, any> = {
        service_order: { prefix: "SO-", next_number: 1, number_length: 6 },
        quote: { prefix: "Q-", next_number: 1, number_length: 6 },
        invoice: { prefix: "INV-", next_number: 1, number_length: 6 },
      };
      
      data?.forEach((setting: any) => {
        settingsMap[setting.entity_type] = {
          prefix: setting.prefix,
          next_number: setting.next_number,
          number_length: setting.number_length,
        };
      });
      
      setSettings(settingsMap);
      return data;
    },
  });

  // Fetch overhead percentage and default margin
  const { data: generalSettings } = useQuery({
    queryKey: ["general-settings-overhead"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings" as any)
        .select("overhead_percentage, default_margin_percentage")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        if ((data as any).overhead_percentage) {
          setOverheadPercentage((data as any).overhead_percentage.toString());
        }
        if ((data as any).default_margin_percentage) {
          setDefaultMarginPercentage((data as any).default_margin_percentage.toString());
        }
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (entityType: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const setting = settings[entityType];
      
      const { error } = await supabase
        .from("sequential_number_settings")
        .upsert({
          tenant_id: profile.tenant_id,
          entity_type: entityType,
          prefix: setting.prefix,
          next_number: setting.next_number,
          number_length: setting.number_length,
        }, {
          onConflict: "tenant_id,entity_type"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequential-number-settings"] });
      toast.success("Numbering settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save numbering settings");
    },
  });

  const updateSetting = (entityType: string, field: string, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [entityType]: {
        ...prev[entityType],
        [field]: field === 'next_number' || field === 'number_length' ? parseInt(value as string) : value,
      }
    }));
  };

  const saveOverheadMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { error } = await supabase
        .from("general_settings" as any)
        .upsert({
          tenant_id: profile.tenant_id,
          overhead_percentage: parseFloat(overheadPercentage),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-settings-overhead"] });
      toast.success("Overhead percentage saved successfully");
    },
    onError: () => {
      toast.error("Failed to save overhead percentage");
    },
  });

  const saveDefaultMarginMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const marginValue = parseFloat(defaultMarginPercentage);
      if (isNaN(marginValue) || marginValue < 0 || marginValue > 1000) {
        throw new Error("Default margin must be between 0 and 1000");
      }

      const { error } = await supabase
        .from("general_settings" as any)
        .upsert({
          tenant_id: profile.tenant_id,
          default_margin_percentage: marginValue,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-settings-overhead"] });
      toast.success("Default margin percentage saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save default margin percentage");
    },
  });

  const getPreview = (entityType: string) => {
    const setting = settings[entityType];
    return `${setting.prefix}${setting.next_number.toString().padStart(setting.number_length, '0')}`;
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">Sequential Numbering & Costing</h3>
        <p className="text-sm text-muted-foreground">
          Configure automatic sequential numbering for service orders, quotes, and invoices. 
          Set overhead percentage for time log cost calculations.
        </p>
      </div>

      {/* Overhead Percentage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Labor Overhead Percentage</CardTitle>
          <CardDescription>
            Overhead percentage applied to worker hourly rates when calculating time log costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="overhead">Overhead Percentage (%)</Label>
              <Input
                id="overhead"
                type="number"
                min="0"
                max="200"
                step="0.1"
                value={overheadPercentage}
                onChange={(e) => setOverheadPercentage(e.target.value)}
                placeholder="20"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: 20% overhead on $50/hr = $60/hr total cost
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={() => saveOverheadMutation.mutate()}
            disabled={saveOverheadMutation.isPending}
          >
            Save Overhead Setting
          </Button>
        </CardContent>
      </Card>

      {/* Default Margin Percentage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Margin Percentage</CardTitle>
          <CardDescription>
            Default margin percentage used when creating new quote line items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="defaultMargin">Default Margin (%)</Label>
              <Input
                id="defaultMargin"
                type="number"
                min="0"
                max="1000"
                step="0.1"
                value={defaultMarginPercentage}
                onChange={(e) => setDefaultMarginPercentage(e.target.value)}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: $100 cost + 30% margin = $130 sell price
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={() => saveDefaultMarginMutation.mutate()}
            disabled={saveDefaultMarginMutation.isPending}
          >
            Save Margin Setting
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.entries(settings).map(([entityType, setting]) => (
          <Card key={entityType}>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {entityType.replace('_', ' ')}
              </CardTitle>
              <CardDescription>
                Next number: <span className="font-mono font-semibold">{getPreview(entityType)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`${entityType}-prefix`}>Prefix</Label>
                  <Input
                    id={`${entityType}-prefix`}
                    value={setting.prefix}
                    onChange={(e) => updateSetting(entityType, 'prefix', e.target.value)}
                    placeholder="e.g., SO-"
                  />
                </div>
                <div>
                  <Label htmlFor={`${entityType}-next`}>Next Number</Label>
                  <Input
                    id={`${entityType}-next`}
                    type="number"
                    min="1"
                    value={setting.next_number}
                    onChange={(e) => updateSetting(entityType, 'next_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`${entityType}-length`}>Padding Length</Label>
                  <Input
                    id={`${entityType}-length`}
                    type="number"
                    min="1"
                    max="10"
                    value={setting.number_length}
                    onChange={(e) => updateSetting(entityType, 'number_length', e.target.value)}
                  />
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => saveMutation.mutate(entityType)}
                disabled={saveMutation.isPending}
              >
                Save {entityType.replace('_', ' ')} Settings
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
