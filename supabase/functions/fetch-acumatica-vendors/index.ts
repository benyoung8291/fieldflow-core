import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const username = Deno.env.get("ACUMATICA_USERNAME");
    const password = Deno.env.get("ACUMATICA_PASSWORD");
    
    if (!username || !password) {
      console.error("Missing Acumatica credentials");
      return new Response(
        JSON.stringify({ error: "Acumatica integration not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { instanceUrl, companyName } = await req.json();
    
    if (!instanceUrl || !companyName) {
      return new Response(
        JSON.stringify({ error: "Instance URL and company name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Fetching vendors from Acumatica:", { instanceUrl, companyName });

    // Authenticate with Acumatica
    const authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: username,
        password: password,
        company: companyName,
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

    // Fetch vendors
    const vendorsResponse = await fetch(
      `${instanceUrl}/entity/Default/20.200.001/Vendor?$select=VendorID,VendorName,Status,MainContact,Email,Phone1&$filter=Status eq 'Active' or Status eq 'OneTime'&$expand=MainContact`,
      {
        headers: {
          "Cookie": cookies,
          "Accept": "application/json",
        },
      }
    );

    if (!vendorsResponse.ok) {
      console.error("Failed to fetch vendors:", vendorsResponse.status);
      throw new Error("Failed to fetch vendors");
    }

    const vendorsData = await vendorsResponse.json();

    // Logout
    await fetch(`${instanceUrl}/entity/auth/logout`, {
      method: "POST",
      headers: {
        "Cookie": cookies,
      },
    });

    console.log(`Fetched ${vendorsData.length || 0} vendors`);

    return new Response(
      JSON.stringify({ vendors: vendorsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Acumatica vendors:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
