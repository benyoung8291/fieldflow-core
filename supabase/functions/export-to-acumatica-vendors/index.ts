import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAcumaticaCredentials } from "../_shared/vault-credentials.ts";

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
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error("User has no tenant");
    }

    // Get Acumatica integration
    const { data: integration, error: integrationError } = await supabase
      .from("accounting_integrations")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "myob_acumatica")
      .eq("is_enabled", true)
      .single();

    if (integrationError || !integration) {
      throw new Error("Acumatica integration not configured");
    }

    // Get credentials from vault
    const credentials = await getAcumaticaCredentials(supabase, integration.id);

    const { supplierIds } = await req.json();
    
    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Supplier IDs are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Exporting vendors to Acumatica:", { count: supplierIds.length });

    // Authenticate with Acumatica
    const authResponse = await fetch(`${integration.acumatica_instance_url}/entity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name: credentials.username, 
        password: credentials.password, 
        company: integration.acumatica_company_name 
      }),
    });

    if (!authResponse.ok) {
      throw new Error("Failed to authenticate with Acumatica");
    }

    const cookies = authResponse.headers.get("set-cookie");
    if (!cookies) {
      throw new Error("No authentication cookies received");
    }

    const results = [];

    for (const supplierId of supplierIds) {
      try {
        // Fetch supplier data
        const { data: supplier, error } = await supabase
          .from("suppliers")
          .select("*")
          .eq("id", supplierId)
          .single();

        if (error || !supplier) {
          throw new Error(`Supplier not found: ${supplierId}`);
        }

        // Create vendor in Acumatica
        const acumaticaVendor = {
          VendorID: { value: supplier.name.substring(0, 30) },
          VendorName: { value: supplier.name },
          Status: { value: "Active" },
          MainContact: {
            Email: { value: supplier.email || "" },
            Phone1: { value: supplier.phone || "" },
          },
        };

        const createResponse = await fetch(
          `${integration.acumatica_instance_url}/entity/Default/23.200.001/Vendor`,
          {
            method: "PUT",
            headers: {
              "Cookie": cookies,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(acumaticaVendor),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Failed to create vendor: ${errorText}`);
        }

        const createdVendor = await createResponse.json();
        const acumaticaVendorId = createdVendor.VendorID?.value;

        // Update supplier with Acumatica ID
        await supabase
          .from("suppliers")
          .update({ xero_contact_id: acumaticaVendorId })
          .eq("id", supplierId);

        results.push({ supplierId, success: true, acumaticaVendorId });
      } catch (error) {
        console.error(`Error exporting supplier ${supplierId}:`, error);
        results.push({ 
          supplierId, 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    // Logout
    await fetch(`${integration.acumatica_instance_url}/entity/auth/logout`, {
      method: "POST",
      headers: { "Cookie": cookies },
    });

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error exporting vendors to Acumatica:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
