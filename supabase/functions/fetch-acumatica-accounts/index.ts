import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const username = Deno.env.get("ACUMATICA_USERNAME");
    const password = Deno.env.get("ACUMATICA_PASSWORD");
    
    if (!username || !password) {
      console.error("Missing Acumatica credentials");
      return new Response(
        JSON.stringify({ error: "Acumatica integration not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { instanceUrl, companyName } = await req.json();
    
    if (!instanceUrl || !companyName) {
      return new Response(
        JSON.stringify({ error: "Instance URL and company name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Fetching accounts from Acumatica:", { instanceUrl, companyName });

    // Authenticate with Acumatica
    const authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: username,
        password: password,
        company: companyName,
      }),
    });

    if (!authResponse.ok) {
      console.error("Acumatica auth failed:", authResponse.status);
      throw new Error("Failed to authenticate with Acumatica");
    }

    const cookies = authResponse.headers.get("set-cookie");
    if (!cookies) {
      throw new Error("No authentication cookies received");
    }

    // Fetch chart of accounts
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
      console.error("Failed to fetch accounts:", accountsResponse.status);
      throw new Error("Failed to fetch chart of accounts");
    }

    const accountsData = await accountsResponse.json();
    
    // Fetch sub-accounts
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
    }

    // Logout
    await fetch(`${instanceUrl}/entity/auth/logout`, {
      method: "POST",
      headers: {
        "Cookie": cookies,
      },
    });

    console.log(`Fetched ${accountsData.value?.length || 0} accounts and ${subAccounts.length} sub-accounts`);

    return new Response(
      JSON.stringify({ 
        accounts: accountsData.value || accountsData,
        subAccounts: subAccounts
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Acumatica accounts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
