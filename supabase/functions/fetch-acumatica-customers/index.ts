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

    console.log("Starting Acumatica customer fetch...");
    console.log("Instance URL:", acumatica_instance_url);
    console.log("Company:", acumatica_company_name);

    // Authenticate with Acumatica
    console.log("Attempting authentication...");
    const authUrl = `${acumatica_instance_url}/entity/auth/login`;
    const authResponse = await fetch(authUrl, {
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

    console.log("Auth response status:", authResponse.status);

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("Acumatica auth failed:", authResponse.status, errorText);
      throw new Error(`Failed to authenticate with Acumatica: ${authResponse.status} ${errorText}`);
    }

    const cookies = authResponse.headers.get("set-cookie");
    if (!cookies) {
      console.error("No authentication cookies received");
      throw new Error("No authentication cookies received");
    }

    console.log("Authentication successful, cookies received");

    // Fetch customers with proper expansion
    const customersUrl = `${acumatica_instance_url}/entity/Default/20.200.001/Customer?$expand=MainContact&$select=CustomerID,CustomerName,Status,MainContact`;
    console.log("Fetching customers from:", customersUrl);

    const customersResponse = await fetch(customersUrl, {
      headers: {
        "Cookie": cookies,
        "Accept": "application/json",
      },
    });

    console.log("Customers response status:", customersResponse.status);

    if (!customersResponse.ok) {
      const errorText = await customersResponse.text();
      console.error("Failed to fetch customers:", customersResponse.status, errorText);
      throw new Error(`Failed to fetch customers: ${customersResponse.status}`);
    }

    const customersData = await customersResponse.json();
    console.log("Raw response type:", typeof customersData);
    console.log("Is array:", Array.isArray(customersData));
    console.log("Response keys:", customersData ? Object.keys(customersData) : "null");

    // Handle different response formats
    let customers = [];
    if (Array.isArray(customersData)) {
      customers = customersData;
    } else if (customersData && Array.isArray(customersData.value)) {
      customers = customersData.value;
    } else if (customersData && typeof customersData === 'object') {
      customers = [customersData];
    }

    console.log(`Processed ${customers.length} customers`);

    // Logout
    await fetch(`${acumatica_instance_url}/entity/auth/logout`, {
      method: "POST",
      headers: {
        "Cookie": cookies,
      },
    });

    console.log("Logout successful");

    return new Response(
      JSON.stringify({ customers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in fetch-acumatica-customers:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
