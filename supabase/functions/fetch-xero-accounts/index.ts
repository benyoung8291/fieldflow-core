import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("XERO_CLIENT_ID");
    const clientSecret = Deno.env.get("XERO_CLIENT_SECRET");
    let refreshToken = Deno.env.get("XERO_REFRESH_TOKEN");
    
    if (!clientId || !clientSecret || !refreshToken) {
      console.error("Missing Xero credentials");
      return new Response(
        JSON.stringify({ error: "Xero integration not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { tenantId } = await req.json();
    
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Xero tenant ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Fetching accounts from Xero for tenant:", tenantId);

    // Refresh the access token
    const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Xero token refresh failed:", tokenResponse.status);
      throw new Error("Failed to refresh Xero access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch chart of accounts
    const accountsResponse = await fetch(
      "https://api.xero.com/api.xro/2.0/Accounts",
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "xero-tenant-id": tenantId,
          "Accept": "application/json",
        },
      }
    );

    if (!accountsResponse.ok) {
      console.error("Failed to fetch Xero accounts:", accountsResponse.status);
      throw new Error("Failed to fetch chart of accounts from Xero");
    }

    const accountsData = await accountsResponse.json();
    
    console.log(`Fetched ${accountsData.Accounts?.length || 0} accounts from Xero`);

    return new Response(
      JSON.stringify({ 
        accounts: accountsData.Accounts || []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Xero accounts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
