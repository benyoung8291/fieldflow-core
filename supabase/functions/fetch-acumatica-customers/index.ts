import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    // Get Acumatica integration settings including credentials
    const { data: integration, error: integrationError } = await supabase
      .from("accounting_integrations")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "myob_acumatica")
      .eq("is_enabled", true)
      .single();

    if (integrationError || !integration) {
      console.error("No Acumatica integration found");
      return new Response(
        JSON.stringify({ error: "Acumatica integration not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { acumatica_username, acumatica_password, acumatica_instance_url, acumatica_company_name } = integration;
    
    if (!acumatica_username || !acumatica_password || !acumatica_instance_url || !acumatica_company_name) {
      console.error("Missing Acumatica credentials or configuration");
      return new Response(
        JSON.stringify({ error: "Acumatica integration not fully configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Fetching customers from Acumatica:", { instanceUrl: acumatica_instance_url, companyName: acumatica_company_name });

    // Authenticate with Acumatica
    const authResponse = await fetch(`${acumatica_instance_url}/entity/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: acumatica_username,
        password: acumatica_password,
        company: acumatica_company_name,
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

    // Fetch customers
    const customersResponse = await fetch(
      `${acumatica_instance_url}/entity/Default/20.200.001/Customer?$select=CustomerID,CustomerName,Status,MainContact,Email,Phone1&$filter=Status eq 'Active' or Status eq 'OneTime'&$expand=MainContact,BillingContact`,
      {
        headers: {
          "Cookie": cookies,
          "Accept": "application/json",
        },
      }
    );

    if (!customersResponse.ok) {
      console.error("Failed to fetch customers:", customersResponse.status);
      throw new Error("Failed to fetch customers");
    }

    const customersData = await customersResponse.json();

    // Logout
    await fetch(`${acumatica_instance_url}/entity/auth/logout`, {
      method: "POST",
      headers: {
        "Cookie": cookies,
      },
    });

    console.log(`Fetched ${customersData.length || 0} customers`);

    return new Response(
      JSON.stringify({ customers: customersData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Acumatica customers:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
