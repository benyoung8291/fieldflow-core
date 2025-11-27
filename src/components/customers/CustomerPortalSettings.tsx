import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CustomerPortalSettingsProps {
  customerId: string;
  tenantId: string;
}

export default function CustomerPortalSettings({ customerId, tenantId }: CustomerPortalSettingsProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["customer-portal-settings", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_portal_settings")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") throw error;
      
      // Return default settings if none exist
      return data || {
        is_enabled: false,
        allow_request_creation: true,
        allow_request_viewing: true,
        allow_location_viewing: true,
      };
    },
  });

  const updateSettings = async (updates: Partial<typeof settings>) => {
    setIsSaving(true);
    try {
      const newSettings = { ...settings, ...updates };
      
      if (settings && 'id' in settings && settings.id) {
        // Update existing
        const { error } = await supabase
          .from("customer_portal_settings")
          .update(newSettings)
          .eq("id", settings.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("customer_portal_settings")
          .insert({
            ...newSettings,
            tenant_id: tenantId,
            customer_id: customerId,
          });
        
        if (error) throw error;
      }
      
      queryClient.invalidateQueries({ queryKey: ["customer-portal-settings", customerId] });
      toast.success("Portal settings updated successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portal Access</CardTitle>
          <CardDescription>
            Enable or disable customer portal access for this customer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_enabled" className="text-base">
                Enable Customer Portal
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow this customer to access the customer portal
              </p>
            </div>
            <Switch
              id="is_enabled"
              checked={settings?.is_enabled || false}
              onCheckedChange={(checked) => updateSettings({ is_enabled: checked })}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {settings?.is_enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Portal Permissions</CardTitle>
            <CardDescription>
              Configure what customers can do in the portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow_request_creation" className="text-base">
                  Allow Request Creation
                </Label>
                <p className="text-sm text-muted-foreground">
                  Customers can create new service requests
                </p>
              </div>
              <Switch
                id="allow_request_creation"
                checked={settings?.allow_request_creation || false}
                onCheckedChange={(checked) => updateSettings({ allow_request_creation: checked })}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow_request_viewing" className="text-base">
                  Allow Request Viewing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Customers can view their service requests and history
                </p>
              </div>
              <Switch
                id="allow_request_viewing"
                checked={settings?.allow_request_viewing || false}
                onCheckedChange={(checked) => updateSettings({ allow_request_viewing: checked })}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow_location_viewing" className="text-base">
                  Allow Location Viewing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Customers can view and manage their locations
                </p>
              </div>
              <Switch
                id="allow_location_viewing"
                checked={settings?.allow_location_viewing || false}
                onCheckedChange={(checked) => updateSettings({ allow_location_viewing: checked })}
                disabled={isSaving}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
