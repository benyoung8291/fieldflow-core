import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get tenant_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error("No tenant found");
    }

    // Get Xero integration
    const { data: integration, error: integrationError } = await supabase
      .from("accounting_integrations")
      .select("id, xero_token_expires_at, xero_client_id, xero_tenant_id")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "xero")
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Xero integration not found" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get encrypted credentials from vault
    const { data: credentials, error: credError } = await supabase
      .rpc("get_xero_credentials", { integration_id: integration.id })
      .single();

    const xeroCredentials = credentials as { client_secret: string | null; refresh_token: string | null; access_token: string | null } | null;

    if (credError || !xeroCredentials || !integration.xero_client_id || !xeroCredentials.client_secret || !xeroCredentials.refresh_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Xero credentials not configured" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!integration.xero_tenant_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Xero tenant not selected" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    let accessToken = xeroCredentials.access_token;

    // Check if token needs refresh
    if (integration.xero_token_expires_at) {
      const expiresAt = new Date(integration.xero_token_expires_at);
      if (expiresAt <= new Date()) {
        // Refresh token
        const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${integration.xero_client_id}:${xeroCredentials.client_secret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: xeroCredentials.refresh_token,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Token refresh failed:", errorText);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Failed to refresh token. Please reconnect to Xero." 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            }
          );
        }

        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;

        // Update tokens in vault
        await supabase.rpc("update_xero_tokens", {
          integration_id: integration.id,
          new_access_token: tokens.access_token,
          new_refresh_token: tokens.refresh_token,
        });

        // Update expiry in database
        await supabase
          .from("accounting_integrations")
          .update({
            xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq("id", integration.id);
      }
    }
    console.log("Fetching chart of accounts from Xero for tenant:", integration.xero_tenant_id);

    // Fetch chart of accounts
    const accountsResponse = await fetch(
      "https://api.xero.com/api.xro/2.0/Accounts",
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "xero-tenant-id": integration.xero_tenant_id,
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
        success: true,
        accounts: accountsData.Accounts || [],
        count: accountsData.Accounts?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Xero accounts:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
