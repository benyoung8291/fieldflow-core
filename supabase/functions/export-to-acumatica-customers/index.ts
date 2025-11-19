import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const username = Deno.env.get("ACUMATICA_USERNAME");
    const password = Deno.env.get("ACUMATICA_PASSWORD");
    
    if (!username || !password) {
      throw new Error("Acumatica credentials not configured");
    }

    const { customerIds, instanceUrl, companyName } = await req.json();
    
    if (!customerIds || !instanceUrl || !companyName) {
      return new Response(
        JSON.stringify({ error: "Customer IDs, instance URL, and company name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Exporting customers to Acumatica:", { count: customerIds.length });

    // Authenticate with Acumatica
    const authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: username, password: password, company: companyName }),
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
          `${instanceUrl}/entity/Default/20.200.001/Customer`,
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
    await fetch(`${instanceUrl}/entity/auth/logout`, {
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
