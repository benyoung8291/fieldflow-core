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
      .select("xero_access_token, xero_refresh_token, xero_token_expires_at, xero_client_id, xero_client_secret")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "xero")
      .single();

    if (integrationError || !integration) {
      throw new Error("Xero integration not found");
    }

    let accessToken = integration.xero_access_token;

    // Check if token needs refresh
    if (integration.xero_token_expires_at) {
      const expiresAt = new Date(integration.xero_token_expires_at);
      if (expiresAt <= new Date()) {
        // Refresh token
        const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${integration.xero_client_id}:${integration.xero_client_secret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: integration.xero_refresh_token!,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to refresh token");
        }

        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;

        // Update tokens
        await supabase
          .from("accounting_integrations")
          .update({
            xero_access_token: tokens.access_token,
            xero_refresh_token: tokens.refresh_token,
            xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq("tenant_id", profile.tenant_id)
          .eq("provider", "xero");
      }
    }

    // Fetch connections
    const connectionsResponse = await fetch("https://api.xero.com/connections", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!connectionsResponse.ok) {
      throw new Error("Failed to fetch Xero connections");
    }

    const connections = await connectionsResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizations: connections.map((conn: any) => ({
          tenantId: conn.tenantId,
          tenantName: conn.tenantName,
          tenantType: conn.tenantType,
        }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error listing Xero organizations:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
