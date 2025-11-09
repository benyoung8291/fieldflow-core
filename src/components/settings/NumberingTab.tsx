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
        <h3 className="text-lg font-medium mb-1">Sequential Numbering</h3>
        <p className="text-sm text-muted-foreground">
          Configure automatic sequential numbering for service orders, quotes, and invoices. 
          This allows you to align numbering with other systems when migrating.
        </p>
      </div>

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
