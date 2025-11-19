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
  const [acumaticaUsername, setAcumaticaUsername] = useState("");
  const [acumaticaPassword, setAcumaticaPassword] = useState("");
  const [acumaticaCredentialsSet, setAcumaticaCredentialsSet] = useState(false);
  
  const [xeroEnabled, setXeroEnabled] = useState(false);
  const [xeroTenantId, setXeroTenantId] = useState("");
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [xeroRefreshToken, setXeroRefreshToken] = useState("");
  const [xeroCredentialsSet, setXeroCredentialsSet] = useState(false);
  const [testingXeroConnection, setTestingXeroConnection] = useState(false);

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

  const testXeroConnection = async () => {
    setTestingXeroConnection(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-xero-connection`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(`Connection successful! ${result.connections} organization(s) found.`);
      } else {
        toast.error(result.error || "Connection test failed");
      }
    } catch (error) {
      console.error("Connection test error:", error);
      toast.error("Failed to test connection");
    } finally {
      setTestingXeroConnection(false);
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

      // Save settings to database
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

      // Save credentials if provided
      if (acumaticaUsername && acumaticaPassword) {
        const { data: { session } } = await supabase.auth.getSession();
        const credentialsResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-acumatica-credentials`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: acumaticaUsername,
              password: acumaticaPassword,
            }),
          }
        );

        if (!credentialsResponse.ok) {
          throw new Error("Failed to save credentials");
        }

        setAcumaticaUsername("");
        setAcumaticaPassword("");
        setAcumaticaCredentialsSet(true);
      }
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

      // Save settings to database
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

      // Save credentials if provided
      if (xeroClientId && xeroClientSecret && xeroRefreshToken) {
        const { data: { session } } = await supabase.auth.getSession();
        const credentialsResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-xero-credentials`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clientId: xeroClientId,
              clientSecret: xeroClientSecret,
              refreshToken: xeroRefreshToken,
            }),
          }
        );

        if (!credentialsResponse.ok) {
          throw new Error("Failed to save credentials");
        }

        setXeroClientId("");
        setXeroClientSecret("");
        setXeroRefreshToken("");
        setXeroCredentialsSet(true);
      }
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
            <div>
              <Label htmlFor="acumatica-username">API Username</Label>
              <Input
                id="acumatica-username"
                type="text"
                value={acumaticaUsername}
                onChange={(e) => setAcumaticaUsername(e.target.value)}
                placeholder="Enter API username"
                disabled={!acumaticaEnabled}
              />
            </div>
            <div>
              <Label htmlFor="acumatica-password">API Password</Label>
              <Input
                id="acumatica-password"
                type="password"
                value={acumaticaPassword}
                onChange={(e) => setAcumaticaPassword(e.target.value)}
                placeholder="Enter API password"
                disabled={!acumaticaEnabled}
              />
            </div>
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                API credentials are stored securely in encrypted storage and never exposed.
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
            <div>
              <Label htmlFor="xero-client-id">Client ID</Label>
              <Input
                id="xero-client-id"
                type="text"
                value={xeroClientId}
                onChange={(e) => setXeroClientId(e.target.value)}
                placeholder="Enter OAuth client ID"
                disabled={!xeroEnabled}
              />
            </div>
            <div>
              <Label htmlFor="xero-client-secret">Client Secret</Label>
              <Input
                id="xero-client-secret"
                type="password"
                value={xeroClientSecret}
                onChange={(e) => setXeroClientSecret(e.target.value)}
                placeholder="Enter OAuth client secret"
                disabled={!xeroEnabled}
              />
            </div>
            <div>
              <Label htmlFor="xero-refresh-token">Refresh Token</Label>
              <Input
                id="xero-refresh-token"
                type="password"
                value={xeroRefreshToken}
                onChange={(e) => setXeroRefreshToken(e.target.value)}
                placeholder="Enter OAuth refresh token"
                disabled={!xeroEnabled}
              />
            </div>
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                OAuth credentials are stored securely in encrypted storage and never exposed.
                {xeroCredentialsSet && (
                  <span className="flex items-center gap-2 mt-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Credentials configured
                  </span>
                )}
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertDescription>
                <strong>Redirect URI for Xero OAuth App:</strong>
                <br />
                <code className="text-sm bg-muted px-2 py-1 rounded mt-1 inline-block">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/xero-oauth-callback
                </code>
                <br />
                <span className="text-xs text-muted-foreground mt-1 inline-block">
                  Use this redirect URI when configuring your Xero OAuth application
                </span>
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
            <Button
              variant="outline"
              onClick={testXeroConnection}
              disabled={testingXeroConnection || !xeroCredentialsSet || !xeroEnabled}
            >
              {testingXeroConnection && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
