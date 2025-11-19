import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Get tenant_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "No tenant found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const tenantId = profile.tenant_id;

    // Get integration settings from database
    const { data: integration, error: integrationError } = await supabase
      .from("accounting_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", "myob_acumatica")
      .eq("is_enabled", true)
      .single();

    if (integrationError || !integration) {
      console.error("Acumatica integration not found:", integrationError);
      return new Response(
        JSON.stringify({ error: "Acumatica integration not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { acumatica_username, acumatica_password, acumatica_instance_url, acumatica_company_name } = integration;
    
    if (!acumatica_username || !acumatica_password || !acumatica_instance_url || !acumatica_company_name) {
      console.error("Missing Acumatica credentials in integration settings");
      return new Response(
        JSON.stringify({ error: "Acumatica integration not properly configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { forceRefresh } = await req.json();
    const instanceUrl = acumatica_instance_url;
    const companyName = acumatica_company_name;
    

    // Check if we have cached data (less than 24 hours old) and not forcing refresh
    if (!forceRefresh) {
      const { data: cachedAccounts } = await supabase
        .from("chart_of_accounts_cache")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "myob_acumatica")
        .gte("cached_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: cachedSubAccounts } = await supabase
        .from("sub_accounts_cache")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "myob_acumatica")
        .gte("cached_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (cachedAccounts && cachedAccounts.length > 0) {
        console.log(`Using cached data: ${cachedAccounts.length} accounts, ${cachedSubAccounts?.length || 0} sub-accounts`);
        return new Response(
          JSON.stringify({ 
            accounts: cachedAccounts.map(a => ({
              AccountCD: { value: a.account_code },
              Description: { value: a.description },
              Type: { value: a.account_type },
              Active: { value: a.is_active }
            })),
            subAccounts: (cachedSubAccounts || []).map(s => ({
              SubAccountCD: { value: s.sub_account_code },
              Description: { value: s.description },
              Active: { value: s.is_active }
            }))
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    console.log("Fetching accounts from Acumatica:", { instanceUrl, companyName });

    let cookies: string | null = null;
    
    try {
      // Authenticate with Acumatica with retry logic for concurrent session limits
      let authResponse;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: acumatica_username,
            password: acumatica_password,
            company: companyName,
          }),
        });

        if (authResponse.ok) {
          break;
        }

        const errorText = await authResponse.text();
        
        // Check if it's a concurrent session limit error
        if (errorText.includes("concurrent") || errorText.includes("session limit")) {
          console.log(`Concurrent session limit hit, retry ${retryCount + 1}/${maxRetries}`);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            continue;
          }
        }
        
        console.error("Acumatica auth failed:", authResponse.status, errorText);
        throw new Error(`Failed to authenticate with Acumatica: ${authResponse.status} - ${errorText.substring(0, 200)}`);
      }

      cookies = authResponse!.headers.get("set-cookie");
      console.log("Received cookies:", cookies ? "Yes" : "No");
      
      if (!cookies) {
        throw new Error("No authentication cookies received from Acumatica");
      }

      // Fetch chart of accounts
      console.log("Fetching accounts with cookie...");
      const accountsResponse = await fetch(
        `${instanceUrl}/entity/Default/20.200.001/Account?$select=AccountCD,Description,Active,Type&$filter=Active eq true`,
        {
          headers: {
            "Cookie": cookies,
            "Accept": "application/json",
          },
        }
      );

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error("Failed to fetch accounts:", accountsResponse.status, errorText);
        throw new Error(`Failed to fetch chart of accounts: ${accountsResponse.status} - ${errorText.substring(0, 200)}`);
      }

      console.log("Successfully fetched accounts");

      const accountsData = await accountsResponse.json();
      
      // Fetch sub-accounts
      console.log("Fetching sub-accounts...");
      const subAccountsResponse = await fetch(
        `${instanceUrl}/entity/Default/20.200.001/SubAccount?$select=SubAccountCD,Description,Active&$filter=Active eq true`,
        {
          headers: {
            "Cookie": cookies,
            "Accept": "application/json",
          },
        }
      );

      let subAccounts = [];
      if (subAccountsResponse.ok) {
        const subAccountsData = await subAccountsResponse.json();
        subAccounts = subAccountsData.value || subAccountsData;
        console.log(`Successfully fetched ${subAccounts.length} sub-accounts`);
      } else {
        console.warn("Failed to fetch sub-accounts:", subAccountsResponse.status);
      }

      console.log(`Fetched ${accountsData.value?.length || 0} accounts and ${subAccounts.length} sub-accounts`);

      // Cache the data
      const accounts = accountsData.value || accountsData;
      
      // Delete old cache for this tenant/provider
      await supabase
        .from("chart_of_accounts_cache")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("provider", "myob_acumatica");

      await supabase
        .from("sub_accounts_cache")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("provider", "myob_acumatica");

      // Insert new cache
      if (accounts && accounts.length > 0) {
        const accountsToCache = accounts.map((account: any) => ({
          tenant_id: tenantId,
          provider: "myob_acumatica",
          account_code: account.AccountCD?.value || account.AccountCD,
          description: account.Description?.value || account.Description,
          account_type: account.Type?.value || account.Type,
          is_active: account.Active?.value !== false,
        }));

        await supabase
          .from("chart_of_accounts_cache")
          .insert(accountsToCache);
      }

      if (subAccounts && subAccounts.length > 0) {
        const subAccountsToCache = subAccounts.map((subAccount: any) => ({
          tenant_id: tenantId,
          provider: "myob_acumatica",
          sub_account_code: subAccount.SubAccountCD?.value || subAccount.SubAccountCD,
          description: subAccount.Description?.value || subAccount.Description,
          is_active: subAccount.Active?.value !== false,
        }));

        await supabase
          .from("sub_accounts_cache")
          .insert(subAccountsToCache);
      }

      return new Response(
        JSON.stringify({ 
          accounts: accounts,
          subAccounts: subAccounts
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } finally {
      // Always logout to prevent session accumulation
      if (cookies) {
        try {
          await fetch(`${instanceUrl}/entity/auth/logout`, {
            method: "POST",
            headers: {
              "Cookie": cookies,
            },
          });
          console.log("Logged out from Acumatica");
        } catch (logoutError) {
          console.error("Error during logout:", logoutError);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Acumatica accounts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
