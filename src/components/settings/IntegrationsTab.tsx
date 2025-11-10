import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Key, CheckCircle2 } from "lucide-react";

export default function IntegrationsTab() {
  const queryClient = useQueryClient();
  
  const [acumaticaEnabled, setAcumaticaEnabled] = useState(false);
  const [acumaticaUrl, setAcumaticaUrl] = useState("");
  const [acumaticaCompany, setAcumaticaCompany] = useState("");
  const [acumaticaCredentialsSet, setAcumaticaCredentialsSet] = useState(false);
  
  const [xeroEnabled, setXeroEnabled] = useState(false);
  const [xeroTenantId, setXeroTenantId] = useState("");
  const [xeroCredentialsSet, setXeroCredentialsSet] = useState(false);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["accounting-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("*");

      if (error) throw error;

      // Populate form with existing data
      const acumatica = data.find((i) => i.provider === "myob_acumatica");
      if (acumatica) {
        setAcumaticaEnabled(acumatica.is_enabled);
        setAcumaticaUrl(acumatica.acumatica_instance_url || "");
        setAcumaticaCompany(acumatica.acumatica_company_name || "");
      }

      const xero = data.find((i) => i.provider === "xero");
      if (xero) {
        setXeroEnabled(xero.is_enabled);
        setXeroTenantId(xero.xero_tenant_id || "");
      }

      // Check if credentials are set (we'll check for non-empty secrets)
      checkCredentialsStatus();

      return data;
    },
  });

  const checkCredentialsStatus = async () => {
    try {
      // Test if Acumatica credentials exist by checking edge function
      const acumaticaTest = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-acumatica-credentials`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      if (acumaticaTest.ok) {
        const result = await acumaticaTest.json();
        setAcumaticaCredentialsSet(result.configured || false);
      }

      // Test if Xero credentials exist
      const xeroTest = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-xero-credentials`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      if (xeroTest.ok) {
        const result = await xeroTest.json();
        setXeroCredentialsSet(result.configured || false);
      }
    } catch (error) {
      console.error("Error checking credentials status:", error);
    }
  };

  const saveAcumaticaMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { error } = await supabase
        .from("accounting_integrations")
        .upsert({
          tenant_id: profile.tenant_id,
          provider: "myob_acumatica",
          is_enabled: acumaticaEnabled,
          acumatica_instance_url: acumaticaUrl,
          acumatica_company_name: acumaticaCompany,
        }, {
          onConflict: "tenant_id,provider"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-integrations"] });
      toast.success("MYOB Acumatica settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save MYOB Acumatica settings");
    },
  });

  const saveXeroMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { error } = await supabase
        .from("accounting_integrations")
        .upsert({
          tenant_id: profile.tenant_id,
          provider: "xero",
          is_enabled: xeroEnabled,
          xero_tenant_id: xeroTenantId,
        }, {
          onConflict: "tenant_id,provider"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-integrations"] });
      toast.success("Xero settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save Xero settings");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">Accounting Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Connect your accounting software to automatically sync approved invoices
        </p>
      </div>

      {/* MYOB Acumatica Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">MYOB Acumatica</CardTitle>
              <CardDescription>
                Sync invoices to MYOB Acumatica when marked as approved
              </CardDescription>
            </div>
            <Switch
              checked={acumaticaEnabled}
              onCheckedChange={setAcumaticaEnabled}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="acumatica-url">Instance URL</Label>
            <Input
              id="acumatica-url"
              value={acumaticaUrl}
              onChange={(e) => setAcumaticaUrl(e.target.value)}
              placeholder="https://your-instance.acumatica.com"
              disabled={!acumaticaEnabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your MYOB Acumatica instance URL
            </p>
          </div>
          <div>
            <Label htmlFor="acumatica-company">Company Name</Label>
            <Input
              id="acumatica-company"
              value={acumaticaCompany}
              onChange={(e) => setAcumaticaCompany(e.target.value)}
              placeholder="Company Name"
              disabled={!acumaticaEnabled}
            />
          </div>
          <div className="space-y-3">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                API credentials (Username and Password) are stored securely in encrypted storage.
                {acumaticaCredentialsSet && (
                  <span className="flex items-center gap-2 mt-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Credentials configured
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => saveAcumaticaMutation.mutate()}
              disabled={saveAcumaticaMutation.isPending || !acumaticaEnabled}
            >
              {saveAcumaticaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Xero Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Xero</CardTitle>
              <CardDescription>
                Sync invoices to Xero when marked as approved
              </CardDescription>
            </div>
            <Switch
              checked={xeroEnabled}
              onCheckedChange={setXeroEnabled}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="xero-tenant">Tenant ID</Label>
            <Input
              id="xero-tenant"
              value={xeroTenantId}
              onChange={(e) => setXeroTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!xeroEnabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your Xero organization tenant ID
            </p>
          </div>
          <div className="space-y-3">
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                OAuth credentials (Client ID, Client Secret, Refresh Token) are stored securely in encrypted storage.
                {xeroCredentialsSet && (
                  <span className="flex items-center gap-2 mt-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Credentials configured
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => saveXeroMutation.mutate()}
              disabled={saveXeroMutation.isPending || !xeroEnabled}
            >
              {saveXeroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
