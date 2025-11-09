import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function GeneralSettingsTab() {
  const queryClient = useQueryClient();
  const [renewalEmail, setRenewalEmail] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (settings) {
      setRenewalEmail(settings.renewal_notification_email || "");
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from("tenant_settings" as any)
          .update({
            renewal_notification_email: renewalEmail,
          })
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from("tenant_settings" as any)
          .insert({
            tenant_id: profile.tenant_id,
            renewal_notification_email: renewalEmail,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contract Renewal Notifications</CardTitle>
          <CardDescription>
            Configure where contract renewal notifications are sent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="renewal-email">Notification Email Address</Label>
            <Input
              id="renewal-email"
              type="email"
              placeholder="contracts@company.com"
              value={renewalEmail}
              onChange={(e) => setRenewalEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Automated renewal reminders will be sent to this email address 30, 60, and 90 days before contract expiry
            </p>
          </div>

          <Button
            onClick={() => updateSettingsMutation.mutate()}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
