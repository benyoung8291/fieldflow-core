import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, FileCheck } from "lucide-react";

export default function APInvoiceSettingsTab() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    variance_threshold_percentage: 10.0,
    require_manager_approval_above_threshold: true,
    auto_approve_within_threshold: false,
  });

  const { isLoading } = useQuery({
    queryKey: ['ap-invoice-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase
        .from('ap_invoice_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          variance_threshold_percentage: data.variance_threshold_percentage,
          require_manager_approval_above_threshold: data.require_manager_approval_above_threshold,
          auto_approve_within_threshold: data.auto_approve_within_threshold,
        });
      }
      
      return data;
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // @ts-ignore - Types will update after migration
      const { data: existingSettings } = await supabase
        .from('ap_invoice_settings')
        .select('id')
        .single();

      if (existingSettings) {
        // Update existing settings
        // @ts-ignore - Types will update after migration
        const { error } = await supabase
          .from('ap_invoice_settings')
          .update({
            ...settings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSettings.id);

        if (error) throw error;
      } else {
        // Insert new settings
        // @ts-ignore - Types will update after migration
        const { error } = await supabase
          .from('ap_invoice_settings')
          .insert([{
            ...settings,
            tenant_id: profile.tenant_id,
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoice-settings'] });
      toast.success('AP Invoice settings saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>3-Way PO Matching Settings</CardTitle>
              <CardDescription>
                Configure variance thresholds and approval workflows for AP invoices
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Variance Threshold */}
          <div className="space-y-2">
            <Label htmlFor="variance-threshold">
              Variance Threshold Percentage
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="variance-threshold"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.variance_threshold_percentage}
                onChange={(e) => setSettings({
                  ...settings,
                  variance_threshold_percentage: parseFloat(e.target.value) || 0
                })}
                className="max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Invoices with variances above this percentage will require manager approval
            </p>
          </div>

          {/* Require Manager Approval */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="require-approval">
                Require Manager Approval Above Threshold
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable to require manager approval when variance exceeds the threshold
              </p>
            </div>
            <Switch
              id="require-approval"
              checked={settings.require_manager_approval_above_threshold}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                require_manager_approval_above_threshold: checked
              })}
            />
          </div>

          {/* Auto Approve Within Threshold */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="auto-approve">
                Auto-Approve Within Threshold
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically approve invoices with variances within the threshold
              </p>
            </div>
            <Switch
              id="auto-approve"
              checked={settings.auto_approve_within_threshold}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                auto_approve_within_threshold: checked
              })}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>How Variance Approval Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Automatic Matching</h4>
            <p className="text-sm text-muted-foreground">
              When you perform 3-way matching on an AP invoice, the system compares invoice line items 
              with the purchase order and calculates variances in quantity and price.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Variance Threshold</h4>
            <p className="text-sm text-muted-foreground">
              If the total variance percentage exceeds your configured threshold ({settings.variance_threshold_percentage}%), 
              the invoice will be flagged for manager approval.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Approval Workflow</h4>
            <p className="text-sm text-muted-foreground">
              Users can request approval from managers, who will receive a notification. Managers 
              (tenant admins and supervisors) can then approve or reject the invoice with variance notes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
