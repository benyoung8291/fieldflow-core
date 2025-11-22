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

    const { customerIds } = await req.json();
    
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Customer IDs are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Exporting customers to Acumatica:", { count: customerIds.length });

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

    for (const customerId of customerIds) {
      try {
        // Fetch customer data
        const { data: customer, error } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();

        if (error || !customer) {
          throw new Error(`Customer not found: ${customerId}`);
        }

        // Create customer in Acumatica
        const acumaticaCustomer = {
          CustomerID: { value: customer.name.substring(0, 30) },
          CustomerName: { value: customer.name },
          Status: { value: "Active" },
          MainContact: {
            Email: { value: customer.email || "" },
            Phone1: { value: customer.phone || "" },
          },
        };

        const createResponse = await fetch(
          `${integration.acumatica_instance_url}/entity/Default/20.200.001/Customer`,
          {
            method: "PUT",
            headers: {
              "Cookie": cookies,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(acumaticaCustomer),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Failed to create customer: ${errorText}`);
        }

        const createdCustomer = await createResponse.json();
        const acumaticaCustomerId = createdCustomer.CustomerID?.value;

        // Update customer with Acumatica ID
        await supabase
          .from("customers")
          .update({ xero_contact_id: acumaticaCustomerId })
          .eq("id", customerId);

        results.push({ customerId, success: true, acumaticaCustomerId });
      } catch (error) {
        console.error(`Error exporting customer ${customerId}:`, error);
        results.push({ 
          customerId, 
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
    console.error("Error exporting customers to Acumatica:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
