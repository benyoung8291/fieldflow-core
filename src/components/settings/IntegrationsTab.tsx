import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [xeroIntegrationId, setXeroIntegrationId] = useState<string | null>(null);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [testingXeroConnection, setTestingXeroConnection] = useState(false);
  const [connectingXero, setConnectingXero] = useState(false);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<Array<{tenantId: string, tenantName: string, tenantType: string}>>([]);

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
        setXeroIntegrationId(xero.id);
        setXeroClientId(xero.xero_client_id || "");
        setXeroClientSecret(xero.xero_client_secret || "");
        
        const hasRefreshToken = !!xero.xero_refresh_token;
        const hasTenantId = !!xero.xero_tenant_id;
        const isFullyConnected = hasRefreshToken && hasTenantId;
        
        setXeroConnected(isFullyConnected);
        
        console.log("Xero connection status:", { 
          hasRefreshToken, 
          hasTenantId,
          tenantId: xero.xero_tenant_id,
          isFullyConnected 
        });
        
        // If we have a refresh token but no tenant ID, show tenant selector
        if (hasRefreshToken && !hasTenantId) {
          // Fetch available organizations
          fetchXeroOrganizations();
        }
      }

      return data;
    },
  });

  const fetchXeroOrganizations = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xero-list-organizations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();
      if (result.success && result.organizations) {
        setAvailableTenants(result.organizations);
        setShowTenantSelector(true);
      } else {
        toast.error("Failed to fetch organizations");
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast.error("Failed to fetch organizations");
    }
  };

  const connectToXero = async () => {
    if (!xeroClientId || !xeroClientSecret) {
      toast.error("Please enter Client ID and Client Secret first");
      return;
    }

    setConnectingXero(true);
    try {
      // Save credentials to integration first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      let integrationId = xeroIntegrationId;
      
      // Create or update integration record
      if (!integrationId) {
        const { data: newIntegration, error: insertError } = await supabase
          .from("accounting_integrations")
          .insert({
            tenant_id: profile.tenant_id,
            provider: "xero",
            name: "Xero",
            xero_client_id: xeroClientId,
            xero_client_secret: xeroClientSecret,
            is_enabled: false
          })
          .select()
          .single();

        if (insertError) throw insertError;
        integrationId = newIntegration.id;
        setXeroIntegrationId(integrationId);
      } else {
        const { error: updateError } = await supabase
          .from("accounting_integrations")
          .update({
            xero_client_id: xeroClientId,
            xero_client_secret: xeroClientSecret
          })
          .eq("id", integrationId);

        if (updateError) throw updateError;
      }

      // Get authorization URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xero-oauth-authorize`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            clientId: xeroClientId,
            integrationId: integrationId
          })
        }
      );

      if (!response.ok) throw new Error("Failed to generate authorization URL");

      const { authUrl } = await response.json();

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        authUrl,
        "Xero OAuth",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for success message
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'xero-oauth-success') {
          toast.success("Connected! Please select your organization.");
          window.removeEventListener('message', handleMessage);
          
          // Fetch available organizations
          await fetchXeroOrganizations();
        }
      };
      window.addEventListener('message', handleMessage);

    } catch (error) {
      console.error("Error connecting to Xero:", error);
      toast.error("Failed to connect to Xero");
    } finally {
      setConnectingXero(false);
    }
  };

  const disconnectXero = async () => {
    try {
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
        .update({
          xero_access_token: null,
          xero_refresh_token: null,
          xero_token_expires_at: null,
          xero_tenant_id: null,
          is_enabled: false,
        })
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", "xero");

      if (error) throw error;

      // Reset local state
      setXeroTenantId("");
      setXeroEnabled(false);
      setXeroConnected(false);
      toast.success("Disconnected from Xero");
      queryClient.invalidateQueries({ queryKey: ["accounting-integrations"] });
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect from Xero");
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

  const testXeroChartOfAccounts = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-xero-accounts`,
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
        toast.success(`Successfully retrieved ${result.count} accounts from Xero chart of accounts!`);
      } else {
        toast.error(result.error || "Failed to fetch chart of accounts");
      }
    } catch (error) {
      console.error("Chart of accounts test error:", error);
      toast.error("Failed to test chart of accounts");
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

  const selectTenant = async (tenantId: string, tenantName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      console.log("Selecting tenant:", { tenantId, tenantName });

      const { error } = await supabase
        .from("accounting_integrations")
        .update({
          xero_tenant_id: tenantId,
          is_enabled: true,
        })
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", "xero");

      if (error) {
        console.error("Error updating tenant:", error);
        throw error;
      }

      console.log("Tenant updated successfully, setting local state");

      // Update local state immediately before closing dialog
      setXeroTenantId(tenantId);
      setXeroEnabled(true);
      setXeroConnected(true);
      
      // Close dialog
      setShowTenantSelector(false);
      
      toast.success(`Connected to ${tenantName}!`);
      
      // Refresh the data to ensure UI is in sync
      await queryClient.invalidateQueries({ queryKey: ["accounting-integrations"] });
      
      console.log("State after selection:", { 
        xeroTenantId: tenantId, 
        xeroEnabled: true, 
        xeroConnected: true 
      });
    } catch (error) {
      console.error("Error selecting tenant:", error);
      toast.error("Failed to select organization");
    }
  };

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
          {xeroConnected && xeroTenantId ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <strong>✅ Connected to Xero</strong>
                <br />
                <span className="text-xs">Tenant ID: {xeroTenantId}</span>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="xero-client-id">Client ID</Label>
              <Input
                id="xero-client-id"
                type="text"
                value={xeroClientId}
                onChange={(e) => setXeroClientId(e.target.value)}
                placeholder="Enter Xero Client ID from developer portal"
                disabled={xeroConnected}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="xero-client-secret">Client Secret</Label>
              <Input
                id="xero-client-secret"
                type="password"
                value={xeroClientSecret}
                onChange={(e) => setXeroClientSecret(e.target.value)}
                placeholder="Enter Xero Client Secret from developer portal"
                disabled={xeroConnected}
              />
            </div>

            {xeroConnected && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  ✅ Connected to Xero{xeroTenantId ? ` (Tenant: ${xeroTenantId})` : ''}
                </AlertDescription>
              </Alert>
            )}

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
            {!xeroConnected ? (
              <Button
                onClick={connectToXero}
                disabled={!xeroClientId || !xeroClientSecret || connectingXero}
              >
                {connectingXero && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Connect to Xero
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => saveXeroMutation.mutate()}
                  disabled={saveXeroMutation.isPending}
                >
                  {saveXeroMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Settings
                </Button>
                <Button
                  variant="outline"
                  onClick={testXeroConnection}
                  disabled={testingXeroConnection}
                >
                  {testingXeroConnection && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  onClick={testXeroChartOfAccounts}
                >
                  Test Chart of Accounts
                </Button>
                <Button
                  variant="destructive"
                  onClick={disconnectXero}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tenant Selection Dialog */}
      <Dialog open={showTenantSelector} onOpenChange={setShowTenantSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Xero Organization</DialogTitle>
            <DialogDescription>
              Choose which Xero organization you want to connect to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {availableTenants.map((tenant) => (
              <Button
                key={tenant.tenantId}
                variant="outline"
                className="w-full justify-start"
                onClick={() => selectTenant(tenant.tenantId, tenant.tenantName)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{tenant.tenantName}</span>
                  <span className="text-xs text-muted-foreground">{tenant.tenantType}</span>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
