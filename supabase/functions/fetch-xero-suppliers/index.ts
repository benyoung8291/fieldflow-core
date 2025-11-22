import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getXeroCredentials, updateXeroTokens } from "../_shared/vault-credentials.ts";

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

    // Get credentials from vault
    const credentials = await getXeroCredentials(supabase, integration.id);
    
    if (!integration.xero_client_id || !credentials.client_secret || !credentials.refresh_token) {
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

    let accessToken = credentials.access_token;

    console.log("🔍 Token status:", {
      hasAccessToken: !!credentials.access_token,
      hasRefreshToken: !!credentials.refresh_token,
      expiresAt: integration.xero_token_expires_at,
      isExpired: integration.xero_token_expires_at ? new Date(integration.xero_token_expires_at) <= new Date() : 'no expiry set'
    });

    // Check if token needs refresh (always refresh if no expiry set or if expired)
    const needsRefresh = !integration.xero_token_expires_at || 
                         new Date(integration.xero_token_expires_at) <= new Date();
    
    if (needsRefresh) {
      console.log("🔄 Refreshing Xero access token...");
      
      if (!credentials.refresh_token) {
        console.error("❌ No refresh token available");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Xero connection expired. Please reconnect to Xero in Settings > Integrations." 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }
      
      // Refresh token
      const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${integration.xero_client_id}:${credentials.client_secret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("❌ Token refresh failed:", tokenResponse.status, errorText);
        
        // Check if refresh token is expired (400 = invalid_grant)
        if (tokenResponse.status === 400) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Xero connection expired. Please reconnect to Xero in Settings > Integrations to re-authorize access." 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 401,
            }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to refresh Xero token (${tokenResponse.status}). Please reconnect to Xero in Settings > Integrations.` 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;
      console.log("✅ Token refreshed successfully, new expiry:", new Date(Date.now() + tokens.expires_in * 1000).toISOString());

      // Update tokens in vault
      await updateXeroTokens(supabase, integration.id, tokens.access_token, tokens.refresh_token);
      
      // Update expiry in database
      const { error: updateError } = await supabase
        .from("accounting_integrations")
        .update({
          xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", "xero");
      
      if (updateError) {
        console.error("⚠️ Failed to update token expiry in database:", updateError);
      }
    } else {
      console.log("✅ Using existing valid access token");
    }

    console.log("Fetching suppliers from Xero for tenant:", integration.xero_tenant_id);

    // Fetch contacts (suppliers) from Xero
    let suppliersResponse = await fetch(
      "https://api.xero.com/api.xro/2.0/Contacts?where=IsSupplier==true",
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "xero-tenant-id": integration.xero_tenant_id,
          "Accept": "application/json",
        },
      }
    );

    console.log("📊 Initial API response status:", suppliersResponse.status);

    // If we get 401, try refreshing the token and retry once
    if (suppliersResponse.status === 401) {
      console.log("🔄 Got 401, attempting token refresh and retry...");
      
      const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${integration.xero_client_id}:${credentials.client_secret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refresh_token,
        }),
      });

      if (tokenResponse.ok) {
        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;
        console.log("✅ Token refreshed, retrying API call");

        // Update tokens in vault
        await updateXeroTokens(supabase, integration.id, tokens.access_token, tokens.refresh_token);
        
        // Update expiry in database
        await supabase
          .from("accounting_integrations")
          .update({
            xero_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq("tenant_id", profile.tenant_id)
          .eq("provider", "xero");

        // Retry the API call with new token
        suppliersResponse = await fetch(
          "https://api.xero.com/api.xro/2.0/Contacts?where=IsSupplier==true",
          {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "xero-tenant-id": integration.xero_tenant_id,
              "Accept": "application/json",
            },
          }
        );
      }
    }

    if (!suppliersResponse.ok) {
      const errorText = await suppliersResponse.text();
      console.error("❌ Failed to fetch Xero suppliers:", suppliersResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: suppliersResponse.status === 401 
            ? "Xero connection expired. Please reconnect to Xero in Settings > Integrations to re-authorize access."
            : `Xero API error (${suppliersResponse.status}): ${errorText}` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: suppliersResponse.status,
        }
      );
    }

    const suppliersData = await suppliersResponse.json();
    
    // Transform Xero contacts to our format
    const suppliers = (suppliersData.Contacts || []).map((contact: any) => ({
      id: contact.ContactID,
      name: contact.Name,
      email: contact.EmailAddress || null,
      phone: contact.Phones?.find((p: any) => p.PhoneType === 'DEFAULT')?.PhoneNumber || null,
      address: contact.Addresses?.find((a: any) => a.AddressType === 'POBOX' || a.AddressType === 'STREET')?.AddressLine1 || null,
      type: 'supplier',
    }));

    console.log(`Fetched ${suppliers.length} suppliers from Xero`);

    return new Response(
      JSON.stringify({ 
        success: true,
        accounts: suppliers,
        count: suppliers.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Xero suppliers:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
