import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ChartOfAccountsSelectorProps {
  accountCode: string;
  subAccount?: string;
  onAccountChange: (accountCode: string) => void;
  onSubAccountChange?: (subAccount: string) => void;
}

export function ChartOfAccountsSelector({
  accountCode,
  subAccount,
  onAccountChange,
  onSubAccountChange,
}: ChartOfAccountsSelectorProps) {
  const [provider, setProvider] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [xeroTenantId, setXeroTenantId] = useState<string | null>(null);

  // Fetch integration settings
  const { data: integrationSettings } = useQuery({
    queryKey: ["accounting-integrations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_enabled", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (integrationSettings) {
      console.log('📊 Integration Settings:', integrationSettings);
      setProvider(integrationSettings.provider);
      setInstanceUrl(integrationSettings.acumatica_instance_url);
      setCompanyName(integrationSettings.acumatica_company_name);
      setXeroTenantId(integrationSettings.xero_tenant_id);
      console.log('📊 Set values:', {
        provider: integrationSettings.provider,
        instanceUrl: integrationSettings.acumatica_instance_url,
        companyName: integrationSettings.acumatica_company_name,
      });
    }
  }, [integrationSettings]);

  // Fetch chart of accounts - from cache first, then API if needed
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["chart-of-accounts", provider, instanceUrl, companyName, xeroTenantId],
    queryFn: async () => {
      console.log('📊 Query running with:', { provider, instanceUrl, companyName, xeroTenantId });
      if (!provider) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return null;

      // Try to get from cache first (less than 24 hours old)
      const { data: cachedAccounts } = await supabase
        .from("chart_of_accounts_cache")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", provider)
        .gte("cached_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      let cachedSubAccounts = null;
      if (provider === "myob_acumatica") {
        const { data } = await supabase
          .from("sub_accounts_cache")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("provider", provider)
          .gte("cached_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        cachedSubAccounts = data;
      }

      // If we have cache, use it
      if (cachedAccounts && cachedAccounts.length > 0) {
        console.log("✅ Using cached chart of accounts data");
        console.log("📊 Cached accounts:", cachedAccounts.length);
        console.log("📊 Cached sub-accounts:", cachedSubAccounts?.length || 0);
        
        if (cachedSubAccounts && cachedSubAccounts.length > 0) {
          console.log("📋 Sample sub-account:", cachedSubAccounts[0]);
        } else {
          console.warn("⚠️ No sub-accounts in cache, will fetch from API");
        }
        
        return {
          accounts: cachedAccounts.map(a => ({
            AccountCD: { value: a.account_code },
            Description: { value: a.description },
            Type: { value: a.account_type },
            Active: { value: a.is_active },
            Code: a.account_code,
            Name: a.description,
          })),
          subAccounts: (cachedSubAccounts || []).map(s => ({
            SubAccountCD: { value: s.sub_account_code },
            Description: { value: s.description },
            Active: { value: s.is_active },
          }))
        };
      }

      console.log("⚠️ No cache found or cache empty, fetching from API with forceRefresh=true");
      // No cache or stale - fetch from API
      if (provider === "myob_acumatica") {
        if (!instanceUrl || !companyName) {
          toast.error("Acumatica configuration incomplete");
          return null;
        }

        console.log("🔄 Calling fetch-acumatica-accounts...");
        const { data, error } = await supabase.functions.invoke("fetch-acumatica-accounts", {
          body: { instanceUrl, companyName, forceRefresh: true },
        });

        if (error) {
          console.error("❌ Error fetching accounts:", error);
          throw error;
        }
        
        console.log("✅ Received data from API:");
        console.log("📊 Accounts:", data?.accounts?.length || 0);
        console.log("📊 Sub-accounts:", data?.subAccounts?.length || 0);
        if (data?.subAccounts && data.subAccounts.length > 0) {
          console.log("📋 Sample sub-account from API:", data.subAccounts[0]);
        }
        
        return data;
      } else if (provider === "xero") {
        if (!xeroTenantId) {
          toast.error("Xero tenant ID not configured");
          return null;
        }

        const { data, error } = await supabase.functions.invoke("fetch-xero-accounts", {
          body: { tenantId: xeroTenantId, forceRefresh: false },
        });

        if (error) {
          console.error("Error fetching accounts:", error);
          throw error;
        }
        return data;
      }

      return null;
    },
    enabled: !!provider && (
      (provider === "myob_acumatica" && !!instanceUrl && !!companyName) ||
      (provider === "xero" && !!xeroTenantId)
    ),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1,
  });

  if (!provider || !integrationSettings?.is_enabled) {
    return (
      <div className="text-sm text-muted-foreground">
        No accounting integration configured. Please configure in Settings.
      </div>
    );
  }

  const accounts = accountsData?.accounts || [];
  const subAccounts = accountsData?.subAccounts || [];
  
  console.log("📊 ChartOfAccountsSelector render:");
  console.log("  - Accounts available:", accounts.length);
  console.log("  - Sub-accounts available:", subAccounts.length);
  console.log("  - Selected account:", accountCode);
  console.log("  - Selected sub-account:", subAccount);
  
  if (subAccounts.length > 0) {
    console.log("  - Sample sub-account:", subAccounts[0]);
  } else {
    console.warn("  ⚠️ No sub-accounts loaded!");
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Chart of Accounts</Label>
        <Select
          value={accountCode}
          onValueChange={onAccountChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account..." />
          </SelectTrigger>
          <SelectContent className="bg-popover z-[100]">
            {accounts.map((account: any) => (
              <SelectItem 
                key={provider === "myob_acumatica" ? account.AccountCD?.value : account.Code}
                value={provider === "myob_acumatica" ? account.AccountCD?.value : account.Code}
              >
                {provider === "myob_acumatica" 
                  ? `${account.AccountCD?.value} - ${account.Description?.value}`
                  : `${account.Code} - ${account.Name}`
                }
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {provider === "myob_acumatica" && onSubAccountChange && (
        <div>
          <Label>Sub-Account</Label>
          <Select
            value={subAccount || ""}
            onValueChange={onSubAccountChange}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select sub-account..." />
            </SelectTrigger>
            <SelectContent className="bg-popover z-[100]">
              {subAccounts.map((subAcc: any) => (
                <SelectItem 
                  key={subAcc.SubAccountCD?.value}
                  value={subAcc.SubAccountCD?.value}
                >
                  {`${subAcc.Description?.value} ${subAcc.SubAccountCD?.value}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
