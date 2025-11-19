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

    // Get request body
    const { accountIds } = await req.json();
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      throw new Error("No account IDs provided");
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
      throw new Error("Xero integration not found");
    }

    if (!integration.xero_tenant_id) {
      throw new Error("Xero tenant not selected");
    }

    let accessToken = integration.xero_access_token;

    // Check if token needs refresh
    if (integration.xero_token_expires_at) {
      const expiresAt = new Date(integration.xero_token_expires_at);
      if (expiresAt <= new Date()) {
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
          throw new Error("Failed to refresh token. Please reconnect to Xero.");
        }

        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;

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

    // Fetch customers from app
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .in("id", accountIds)
      .eq("tenant_id", profile.tenant_id);

    if (customersError) {
      throw customersError;
    }

    if (!customers || customers.length === 0) {
      throw new Error("No customers found");
    }

    console.log(`Exporting ${customers.length} customers to Xero`);

    let successCount = 0;
    const errors: any[] = [];

    // Export each customer to Xero
    for (const customer of customers) {
      try {
        // Transform to Xero format
        const xeroContact: any = {
          Name: customer.name,
          EmailAddress: customer.email || undefined,
          ContactStatus: customer.is_active ? "ACTIVE" : "ARCHIVED",
        };

        // Add phone if available
        if (customer.phone) {
          xeroContact.Phones = [
            {
              PhoneType: "DEFAULT",
              PhoneNumber: customer.phone,
            },
          ];
        }

        // Add address if available
        if (customer.address) {
          xeroContact.Addresses = [
            {
              AddressType: "STREET",
              AddressLine1: customer.address,
              City: customer.city || undefined,
              Region: customer.state || undefined,
              PostalCode: customer.postcode || undefined,
              Country: "Australia",
            },
          ];
        }

        // Create contact in Xero
        const createResponse = await fetch(
          "https://api.xero.com/api.xro/2.0/Contacts",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "xero-tenant-id": integration.xero_tenant_id,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({ Contacts: [xeroContact] }),
          }
        );

        if (!createResponse.ok) {
          const errorData = await createResponse.text();
          console.error(`Failed to create customer ${customer.name}:`, errorData);
          errors.push({
            customerId: customer.id,
            customerName: customer.name,
            error: errorData,
          });
        } else {
          successCount++;
          console.log(`Successfully exported customer: ${customer.name}`);
        }
      } catch (error) {
        console.error(`Error exporting customer ${customer.name}:`, error);
        errors.push({
          customerId: customer.id,
          customerName: customer.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        count: successCount,
        total: customers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error exporting customers to Xero:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
