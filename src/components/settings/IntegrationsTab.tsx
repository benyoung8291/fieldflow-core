import { useState, useEffect } from "react";
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
import { Loader2, Key, CheckCircle2, Edit2, Shield, RefreshCw, Zap } from "lucide-react";
import { ChartOfAccountsSelector } from "@/components/expenses/ChartOfAccountsSelector";

export default function IntegrationsTab() {
  const queryClient = useQueryClient();
  
  const [acumaticaEnabled, setAcumaticaEnabled] = useState(false);
  const [acumaticaUrl, setAcumaticaUrl] = useState("");
  const [acumaticaCompany, setAcumaticaCompany] = useState("");
  const [acumaticaUsername, setAcumaticaUsername] = useState("");
  const [acumaticaPassword, setAcumaticaPassword] = useState("");
  const [acumaticaDefaultSalesAccount, setAcumaticaDefaultSalesAccount] = useState("");
  const [acumaticaDefaultSalesSubAccount, setAcumaticaDefaultSalesSubAccount] = useState("");
  const [acumaticaHasEncryptedCredentials, setAcumaticaHasEncryptedCredentials] = useState(false);
  const [updatingAcumaticaCredentials, setUpdatingAcumaticaCredentials] = useState(false);
  const [testingAcumaticaConnection, setTestingAcumaticaConnection] = useState(false);
  const [refreshingAcumaticaAccounts, setRefreshingAcumaticaAccounts] = useState(false);
  
  const [xeroEnabled, setXeroEnabled] = useState(false);
  const [xeroTenantId, setXeroTenantId] = useState("");
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [xeroIntegrationId, setXeroIntegrationId] = useState<string | null>(null);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroHasEncryptedCredentials, setXeroHasEncryptedCredentials] = useState(false);
  const [updatingXeroCredentials, setUpdatingXeroCredentials] = useState(false);
  const [testingXeroConnection, setTestingXeroConnection] = useState(false);
  const [connectingXero, setConnectingXero] = useState(false);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<Array<{tenantId: string, tenantName: string, tenantType: string}>>([]);

  // Fetch chart of accounts cache info
  const { data: accountsCache } = useQuery({
    queryKey: ["chart-of-accounts-cache-info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from("chart_of_accounts_cache")
        .select("cached_at")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", "myob_acumatica")
        .order("cached_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data;
    },
  });

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["accounting-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("*");

      if (error) {
        console.error("Error fetching integrations:", error);
        throw error;
      }
      
      console.log("Fetched integrations:", data);
      return data;
    },
  });

  // Use useEffect to properly sync state with fetched data
  useEffect(() => {
    if (!integrations) return;

    const acumatica = integrations.find((i) => i.provider === "myob_acumatica");
    if (acumatica) {
      setAcumaticaEnabled(acumatica.is_enabled);
      setAcumaticaUrl(acumatica.acumatica_instance_url || "");
      setAcumaticaCompany(acumatica.acumatica_company_name || "");
      
      // Check if credentials are encrypted - password marker or username present indicates configured
      const hasEncryptedPassword = acumatica.acumatica_password === "[ENCRYPTED]";
      const hasUsername = !!acumatica.acumatica_username && acumatica.acumatica_username !== "[ENCRYPTED]";
      const hasEncryptedCreds = hasEncryptedPassword || hasUsername;
      
      setAcumaticaHasEncryptedCredentials(hasEncryptedCreds);
      setAcumaticaDefaultSalesAccount(acumatica.default_sales_account_code || "");
      setAcumaticaDefaultSalesSubAccount(acumatica.default_sales_sub_account || "");
      
      // Clear credential fields when we have encrypted creds
      if (hasEncryptedCreds && !updatingAcumaticaCredentials) {
        setAcumaticaUsername("");
        setAcumaticaPassword("");
      }
    }

    const xero = integrations.find((i) => i.provider === "xero");
    console.log("Found Xero integration:", xero);
    if (xero) {
      setXeroEnabled(xero.is_enabled);
      setXeroTenantId(xero.xero_tenant_id || "");
      setXeroIntegrationId(xero.id);
      
      // Check if credentials are encrypted
      const hasEncryptedClientId = xero.xero_client_id === "[ENCRYPTED]";
      const hasEncryptedClientSecret = xero.xero_client_secret === "[ENCRYPTED]";
      const hasEncryptedCreds = hasEncryptedClientId || hasEncryptedClientSecret;
      
      setXeroHasEncryptedCredentials(hasEncryptedCreds);
      setXeroClientId(hasEncryptedCreds ? "" : xero.xero_client_id || "");
      setXeroClientSecret(hasEncryptedCreds ? "" : xero.xero_client_secret || "");
      
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
        fetchXeroOrganizations();
      }
    }
  }, [integrations, updatingAcumaticaCredentials]);

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

  const testAcumaticaConnection = async () => {
    setTestingAcumaticaConnection(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-acumatica-connection`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || "Connection successful!");
      } else {
        toast.error(result.error || "Connection test failed");
      }
    } catch (error) {
      console.error("Connection test error:", error);
      toast.error("Failed to test connection");
    } finally {
      setTestingAcumaticaConnection(false);
    }
  };

  const refreshAcumaticaChartOfAccounts = async () => {
    setRefreshingAcumaticaAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-acumatica-accounts");
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Refreshed ${data.accountCount || 0} accounts and ${data.subAccountCount || 0} sub-accounts`);
        queryClient.invalidateQueries({ queryKey: ["chart-of-accounts-cache-info"] });
        queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["sub-accounts"] });
      } else {
        toast.error(data?.error || "Failed to refresh chart of accounts");
      }
    } catch (error) {
      console.error("Error refreshing chart of accounts:", error);
      toast.error("Failed to refresh chart of accounts");
    } finally {
      setRefreshingAcumaticaAccounts(false);
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

      // Use UPSERT to handle both new and existing connections
      const { data: integration, error: upsertError } = await supabase
        .from("accounting_integrations")
        .upsert({
          tenant_id: profile.tenant_id,
          provider: "xero",
          name: "Xero",
          xero_client_id: xeroClientId,
          xero_client_secret: xeroClientSecret,
          is_enabled: false
        }, {
          onConflict: 'tenant_id,provider',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (upsertError) throw upsertError;
      const integrationId = integration.id;
      setXeroIntegrationId(integrationId);

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
          
          // Refresh the integrations data and wait for it to complete
          await queryClient.refetchQueries({ queryKey: ["accounting-integrations"] });
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
          default_sales_account_code: acumaticaDefaultSalesAccount,
          default_sales_sub_account: acumaticaDefaultSalesSubAccount,
        }, {
          onConflict: "tenant_id,provider"
        });

      if (error) {
        console.error("Error saving Acumatica settings:", error);
        throw error;
      }

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
          const errorData = await credentialsResponse.json();
          console.error("Failed to save credentials:", errorData);
          throw new Error(errorData.error || "Failed to save credentials");
        }

        // Clear credential fields after successful save
        setAcumaticaUsername("");
        setAcumaticaPassword("");
        setUpdatingAcumaticaCredentials(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-integrations"] });
      toast.success("MYOB Acumatica settings saved successfully");
    },
    onError: (error: Error) => {
      console.error("Save mutation error:", error);
      toast.error(`Failed to save settings: ${error.message}`);
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
            {acumaticaHasEncryptedCredentials && !updatingAcumaticaCredentials ? (
              <Alert className="bg-accent/50">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>✓ API credentials configured securely</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUpdatingAcumaticaCredentials(true)}
                      disabled={!acumaticaEnabled}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Update Credentials
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <>
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
                {updatingAcumaticaCredentials && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUpdatingAcumaticaCredentials(false);
                      setAcumaticaUsername("");
                      setAcumaticaPassword("");
                    }}
                  >
                    Cancel Update
                  </Button>
                )}
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    API credentials are stored securely in encrypted storage and never exposed.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Default Sales Account</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Default chart of accounts for AR invoice line items
            </p>
            {acumaticaEnabled && (
              <ChartOfAccountsSelector
                accountCode={acumaticaDefaultSalesAccount}
                subAccount={acumaticaDefaultSalesSubAccount}
                onAccountChange={setAcumaticaDefaultSalesAccount}
                onSubAccountChange={setAcumaticaDefaultSalesSubAccount}
              />
            )}
            {!acumaticaEnabled && (
              <p className="text-sm text-muted-foreground">Enable Acumatica integration to configure default accounts</p>
            )}
          </div>

          {/* Chart of Accounts Cache Info */}
          {acumaticaEnabled && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Chart of Accounts Cache</p>
                  <p className="text-xs text-muted-foreground">
                    {accountsCache?.cached_at 
                      ? `Last refreshed: ${new Date(accountsCache.cached_at).toLocaleDateString()} ${new Date(accountsCache.cached_at).toLocaleTimeString()}`
                      : "Not yet cached"
                    }
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAcumaticaChartOfAccounts}
                  disabled={refreshingAcumaticaAccounts || !acumaticaHasEncryptedCredentials}
                >
                  {refreshingAcumaticaAccounts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1">Refresh</span>
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => saveAcumaticaMutation.mutate()}
              disabled={saveAcumaticaMutation.isPending || !acumaticaEnabled}
            >
              {saveAcumaticaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            {acumaticaEnabled && acumaticaHasEncryptedCredentials && (
              <Button
                variant="outline"
                onClick={testAcumaticaConnection}
                disabled={testingAcumaticaConnection}
              >
                {testingAcumaticaConnection ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            )}
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
            {xeroHasEncryptedCredentials && !updatingXeroCredentials && !xeroConnected ? (
              <Alert className="bg-accent/50">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>✓ OAuth credentials configured securely</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUpdatingXeroCredentials(true)}
                      disabled={xeroConnected}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Update Credentials
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <>
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
                
                {updatingXeroCredentials && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUpdatingXeroCredentials(false);
                      setXeroClientId("");
                      setXeroClientSecret("");
                    }}
                  >
                    Cancel Update
                  </Button>
                )}
              </>
            )}

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
              <>
                <Button
                  onClick={connectToXero}
                  disabled={!xeroClientId || !xeroClientSecret || connectingXero}
                >
                  {connectingXero && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Connect to Xero
                </Button>
                {xeroIntegrationId && (
                  <Button
                    variant="destructive"
                    onClick={disconnectXero}
                  >
                    Clear Old Connection
                  </Button>
                )}
              </>
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
