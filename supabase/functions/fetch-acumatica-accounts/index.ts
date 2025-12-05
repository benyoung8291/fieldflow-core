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
      .select("id, acumatica_username, acumatica_instance_url, acumatica_company_name")
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

    // Get encrypted password from vault
    const { data: password } = await supabase
      .rpc("get_acumatica_password", { integration_id: integration.id })
      .single();
    
    const { acumatica_username, acumatica_instance_url, acumatica_company_name } = integration;
    
    if (!acumatica_username || !password || !acumatica_instance_url || !acumatica_company_name) {
      console.error("Missing Acumatica credentials in integration settings");
      return new Response(
        JSON.stringify({ error: "Acumatica integration not properly configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const acumatica_password = password;

    // Parse request body safely - handle empty or missing body
    let forceRefresh = false;
    try {
      const body = await req.text();
      if (body && body.trim()) {
        const parsed = JSON.parse(body);
        forceRefresh = parsed.forceRefresh || false;
      }
    } catch (parseError) {
      console.log("No request body or invalid JSON, using defaults");
    }

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

      // Parse cookies properly - Acumatica may return multiple set-cookie headers
      const setCookieHeader = authResponse!.headers.get("set-cookie");
      console.log("Raw set-cookie header:", setCookieHeader ? "Present" : "Missing");
      
      if (!setCookieHeader) {
        throw new Error("No authentication cookies received from Acumatica");
      }

      // Parse multiple cookies if present
      const setCookieHeaders: string[] = [];
      if (setCookieHeader.includes(',')) {
        // Multiple cookies in one header
        const parts = setCookieHeader.split(',');
        for (const part of parts) {
          const trimmedPart = part.trim();
          if (trimmedPart.includes('=')) {
            setCookieHeaders.push(trimmedPart);
          }
        }
      } else {
        setCookieHeaders.push(setCookieHeader);
      }

      if (setCookieHeaders.length === 0) {
        throw new Error("No valid cookies found in response");
      }

      // Join all cookies into a single Cookie header value (name=value pairs only)
      cookies = setCookieHeaders
        .map(cookie => cookie.split(';')[0]) // Take only the name=value part
        .join('; ');
      
      console.log("Authentication successful, cookies received");
      console.log("Cookie header value:", cookies.substring(0, 50) + "...");

      // Fetch chart of accounts
      console.log("Fetching accounts with cookie...");
      const accountsUrl = `${instanceUrl}/entity/Default/23.200.001/Account?$select=AccountCD,Description,Active,Type&$filter=Active eq true`;
      console.log("Accounts URL:", accountsUrl);
      
      const accountsResponse = await fetch(accountsUrl, {
        method: "GET",
        headers: {
          "Cookie": cookies,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      console.log("Accounts response status:", accountsResponse.status);
      
      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error("Failed to fetch accounts:", accountsResponse.status);
        console.error("Full error response:", errorText);
        console.error("Response headers:", Object.fromEntries(accountsResponse.headers.entries()));
        throw new Error(`Failed to fetch chart of accounts: ${accountsResponse.status} - ${errorText.substring(0, 500)}`);
      }

      console.log("Successfully fetched accounts");

      const accountsData = await accountsResponse.json();
      
      // Log first few accounts to see the actual structure
      if (accountsData.value && accountsData.value.length > 0) {
        console.log("Sample account data:", JSON.stringify(accountsData.value.slice(0, 2), null, 2));
      }
      
      // Fetch sub-accounts
      console.log("Fetching sub-accounts...");
      const subAccountsUrl = `${instanceUrl}/entity/Default/23.200.001/Subaccount?$select=SubaccountCD,Description,Active&$filter=Active eq true`;
      console.log("Sub-accounts URL:", subAccountsUrl);
      
      const subAccountsResponse = await fetch(subAccountsUrl, {
        method: "GET",
        headers: {
          "Cookie": cookies,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      let subAccounts = [];
      if (subAccountsResponse.ok) {
        const subAccountsData = await subAccountsResponse.json();
        subAccounts = subAccountsData.value || subAccountsData;
        console.log(`Successfully fetched ${subAccounts.length} sub-accounts`);
        
        // Log first few sub-accounts to see the actual structure
        if (subAccounts.length > 0) {
          console.log("Sample sub-account data:", JSON.stringify(subAccounts.slice(0, 3), null, 2));
        }
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
          sub_account_code: subAccount.SubaccountCD?.value || subAccount.SubaccountCD,
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
