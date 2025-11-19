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

    console.log("Fetching customers from Acumatica:", { instanceUrl, companyName });

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

    // Fetch customers
    const customersResponse = await fetch(
      `${instanceUrl}/entity/Default/20.200.001/Customer?$select=CustomerID,CustomerName,Status,MainContact,Email,Phone1&$filter=Status eq 'Active' or Status eq 'OneTime'&$expand=MainContact,BillingContact`,
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
    await fetch(`${instanceUrl}/entity/auth/logout`, {
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
