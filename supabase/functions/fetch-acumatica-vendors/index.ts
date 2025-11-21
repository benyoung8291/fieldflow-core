import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeError, sanitizeAuthError } from "../_shared/errorHandler.ts";

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

    console.log("Starting Acumatica vendor fetch...");
    
    // Ensure URL doesn't have trailing slash
    const baseUrl = acumatica_instance_url.replace(/\/$/, '');
    console.log("Instance URL:", baseUrl);
    console.log("Company:", acumatica_company_name);

    let cookies: string | null = null;
    let retryCount = 0;
    const maxRetries = 2;
    const retryDelay = 2000; // 2 seconds

    try {
      // Authenticate with Acumatica (with retry for concurrent session limit)
      let authResponse: Response | null = null;
      
      while (retryCount <= maxRetries) {
        console.log("Attempting authentication... (attempt " + (retryCount + 1) + ")");
        const authUrl = `${baseUrl}/entity/auth/login`;
        authResponse = await fetch(authUrl, {
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
          
          // Check for concurrent login limit error
          if (errorText.includes("concurrent API logins")) {
            if (retryCount < maxRetries) {
              console.log(`Concurrent session limit hit, waiting ${retryDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retryCount++;
              continue; // Retry
            } else {
              return new Response(
                JSON.stringify({ 
                  error: "Acumatica concurrent session limit reached. Please wait a few minutes or increase the API session limit in Acumatica user settings (System → Users → Number of Concurrent API Calls).",
                  retryable: true
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
              );
            }
          }
          
          throw new Error(`Failed to authenticate with Acumatica: ${authResponse.status}`);
        }
        
        // Success - break out of retry loop
        break;
      }

      if (!authResponse) {
        throw new Error("Failed to authenticate after retries");
      }

      // Get all Set-Cookie headers (there may be multiple)
      const setCookieHeaders = authResponse.headers.getSetCookie?.() || [];
      console.log("Number of Set-Cookie headers:", setCookieHeaders.length);
      
      // Fallback to single header if getSetCookie not available
      if (setCookieHeaders.length === 0) {
        const singleCookie = authResponse.headers.get("set-cookie");
        if (singleCookie) {
          setCookieHeaders.push(singleCookie);
        }
      }
      
      if (setCookieHeaders.length === 0) {
        console.error("No authentication cookies received");
        throw new Error("No authentication cookies received");
      }

      // Join all cookies into a single Cookie header value
      cookies = setCookieHeaders
        .map(cookie => cookie.split(';')[0]) // Take only the name=value part
        .join('; ');
      
      console.log("Authentication successful, cookies received");
      console.log("Cookie header value:", cookies.substring(0, 50) + "...");

      // Fetch vendors with proper expansion
      const vendorsUrl = `${baseUrl}/entity/Default/23.200.001/Vendor?$expand=MainContact&$select=VendorID,VendorName,Status,MainContact`;
      console.log("Fetching vendors from:", vendorsUrl);

      const vendorsResponse = await fetch(vendorsUrl, {
        headers: {
          "Cookie": cookies,
          "Accept": "application/json",
        },
      });

      console.log("Vendors response status:", vendorsResponse.status);

      if (!vendorsResponse.ok) {
        const errorText = await vendorsResponse.text();
        console.error("Failed to fetch vendors:", vendorsResponse.status, errorText);
        
        if (vendorsResponse.status === 401) {
          throw new Error("Authentication expired or invalid. Please verify your Acumatica credentials.");
        }
        
        throw new Error(`Failed to fetch vendors: ${vendorsResponse.status}`);
      }

      const vendorsData = await vendorsResponse.json();
      console.log("Raw response type:", typeof vendorsData);
      console.log("Is array:", Array.isArray(vendorsData));
      console.log("Response keys:", vendorsData ? Object.keys(vendorsData) : "null");

      // Handle different response formats
      let vendors = [];
      if (Array.isArray(vendorsData)) {
        vendors = vendorsData;
      } else if (vendorsData && Array.isArray(vendorsData.value)) {
        vendors = vendorsData.value;
      } else if (vendorsData && typeof vendorsData === 'object') {
        vendors = [vendorsData];
      }

      console.log(`Processed ${vendors.length} vendors`);

      return new Response(
        JSON.stringify({ vendors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } finally {
      // Always logout to prevent session accumulation
      if (cookies) {
        try {
          console.log("Logging out...");
          await fetch(`${baseUrl}/entity/auth/logout`, {
            method: "POST",
            headers: {
              "Cookie": cookies,
            },
          });
          console.log("Logout successful");
        } catch (logoutError) {
          console.error("Logout failed (non-critical):", logoutError);
        }
      }
    }
  } catch (error) {
    console.error("Error in fetch-acumatica-vendors:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    
    // For development/debugging, return more detailed error
    // In production, you'd use sanitizeError
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
