import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ProjectIntegrationTab() {
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string>("");
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchTenantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (profile) setTenantId(profile.tenant_id);
      }
    };
    fetchTenantId();
  }, []);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("tenant_settings" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setIntegrationEnabled((data as any).projects_service_orders_integration);
      }
      
      return data;
    },
    enabled: !!tenantId,
  });

  const handleToggle = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from("tenant_settings" as any)
          .update({ projects_service_orders_integration: enabled })
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("tenant_settings" as any)
          .insert({
            tenant_id: tenantId,
            projects_service_orders_integration: enabled,
          });

        if (error) throw error;
      }

      setIntegrationEnabled(enabled);
      toast({
        title: "Success",
        description: "Integration setting updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects & Service Orders Integration</CardTitle>
          <CardDescription>
            Configure how projects interact with service orders in your system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="integration-toggle" className="text-base">
                Enable Service Order Integration
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, service orders can be linked to projects. Service order tabs will appear on project details pages, and projects can be selected when creating service orders.
              </p>
            </div>
            <Switch
              id="integration-toggle"
              checked={integrationEnabled}
              onCheckedChange={handleToggle}
              disabled={isSaving}
            />
          </div>

          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium mb-2">What this affects:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Service Order tabs visibility on project detail pages</li>
              <li>Project selection dropdown in service order creation forms</li>
              <li>Project-based filtering in service order lists</li>
              <li>Service order counts and metrics on project dashboards</li>
            </ul>
          </div>

          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <h4 className="font-medium text-yellow-700 dark:text-yellow-400 mb-2">Note:</h4>
            <p className="text-sm text-yellow-600 dark:text-yellow-300">
              Disabling this integration will not delete existing relationships between projects and service orders, but it will hide the integration features in the UI.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
