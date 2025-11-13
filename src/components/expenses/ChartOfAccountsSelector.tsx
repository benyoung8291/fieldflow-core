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
      setProvider(integrationSettings.provider);
      setInstanceUrl(integrationSettings.acumatica_instance_url);
      setCompanyName(integrationSettings.acumatica_company_name);
      setXeroTenantId(integrationSettings.xero_tenant_id);
    }
  }, [integrationSettings]);

  // Fetch chart of accounts based on provider
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["chart-of-accounts", provider, instanceUrl, companyName, xeroTenantId],
    queryFn: async () => {
      if (!provider) return null;

      if (provider === "acumatica") {
        if (!instanceUrl || !companyName) {
          toast.error("Acumatica configuration incomplete");
          return null;
        }

        const { data, error } = await supabase.functions.invoke("fetch-acumatica-accounts", {
          body: { instanceUrl, companyName },
        });

        if (error) throw error;
        return data;
      } else if (provider === "xero") {
        if (!xeroTenantId) {
          toast.error("Xero tenant ID not configured");
          return null;
        }

        const { data, error } = await supabase.functions.invoke("fetch-xero-accounts", {
          body: { tenantId: xeroTenantId },
        });

        if (error) throw error;
        return data;
      }

      return null;
    },
    enabled: !!provider && (
      (provider === "acumatica" && !!instanceUrl && !!companyName) ||
      (provider === "xero" && !!xeroTenantId)
    ),
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
          <SelectContent>
            {accounts.map((account: any) => (
              <SelectItem 
                key={provider === "acumatica" ? account.AccountCD?.value : account.Code}
                value={provider === "acumatica" ? account.AccountCD?.value : account.Code}
              >
                {provider === "acumatica" 
                  ? `${account.AccountCD?.value} - ${account.Description?.value}`
                  : `${account.Code} - ${account.Name}`
                }
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {provider === "acumatica" && onSubAccountChange && (
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
            <SelectContent>
              {subAccounts.map((subAcc: any) => (
                <SelectItem 
                  key={subAcc.SubAccountCD?.value}
                  value={subAcc.SubAccountCD?.value}
                >
                  {`${subAcc.SubAccountCD?.value} - ${subAcc.Description?.value}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
