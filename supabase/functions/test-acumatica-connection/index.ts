import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Verify the user is authenticated
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

    // Get integration settings
    const { data: integration } = await supabase
      .from("accounting_integrations")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "myob_acumatica")
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Acumatica integration not configured" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!integration.acumatica_instance_url) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Acumatica instance URL not configured" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get password from vault
    const { data: password, error: passError } = await supabase
      .rpc("get_acumatica_password", { integration_id: integration.id });

    if (passError || !password) {
      console.error("Failed to get password from vault:", passError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API credentials not configured. Please save your username and password." 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!integration.acumatica_username) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API username not configured" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const baseUrl = integration.acumatica_instance_url.replace(/\/$/, '');
    const companyName = integration.acumatica_company_name || "";
    
    console.log("Testing Acumatica connection...");
    console.log("Base URL:", baseUrl);
    console.log("Company:", companyName);
    console.log("Username:", integration.acumatica_username);

    // Attempt to authenticate with Acumatica
    const loginUrl = `${baseUrl}/entity/auth/login`;
    const loginPayload = {
      name: integration.acumatica_username,
      password: password,
      company: companyName,
    };

    console.log("Attempting login to:", loginUrl);

    const loginResponse = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginPayload),
    });

    console.log("Login response status:", loginResponse.status);

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error("Login failed:", errorText);
      
      if (loginResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid credentials. Please check your username and password." 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Authentication failed: ${loginResponse.status} - ${errorText}` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get cookies for logout
    const cookies = loginResponse.headers.get("set-cookie");

    // Test a simple API call - get current user info or company info
    let companyInfo = null;
    try {
      const companyUrl = `${baseUrl}/entity/Default/23.200.001/Company?$top=1`;
      const companyResponse = await fetch(companyUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies || "",
        },
      });
      
      if (companyResponse.ok) {
        const companies = await companyResponse.json();
        if (companies && companies.length > 0) {
          companyInfo = companies[0];
        }
      }
    } catch (e) {
      console.log("Could not fetch company info:", e);
    }

    // Logout
    try {
      const logoutUrl = `${baseUrl}/entity/auth/logout`;
      await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies || "",
        },
      });
      console.log("Logged out successfully");
    } catch (e) {
      console.log("Logout error (non-critical):", e);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Connection successful! Connected to ${companyName || 'MYOB Acumatica'}`,
        company: companyInfo?.CompanyCD?.value || companyName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error testing connection:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to test connection" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
