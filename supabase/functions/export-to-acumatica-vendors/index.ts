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

    const { supplierIds, instanceUrl, companyName } = await req.json();
    
    if (!supplierIds || !instanceUrl || !companyName) {
      return new Response(
        JSON.stringify({ error: "Supplier IDs, instance URL, and company name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Exporting vendors to Acumatica:", { count: supplierIds.length });

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
          `${instanceUrl}/entity/Default/20.200.001/Vendor`,
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
    await fetch(`${instanceUrl}/entity/auth/logout`, {
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
