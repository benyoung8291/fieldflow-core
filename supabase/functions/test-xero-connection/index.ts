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
      .select("xero_access_token, xero_refresh_token, xero_token_expires_at, xero_client_id, xero_client_secret, xero_tenant_id")
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

    if (!integration.xero_client_id || !integration.xero_client_secret || !integration.xero_refresh_token) {
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
            refresh_token: integration.xero_refresh_token,
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

    // Test API access by fetching connections
    const connectionsResponse = await fetch("https://api.xero.com/connections", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!connectionsResponse.ok) {
      const errorText = await connectionsResponse.text();
      console.error("Connections fetch failed:", errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to fetch Xero connections" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const connections = await connectionsResponse.json();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully connected to Xero",
        connections: connections.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Test connection error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
