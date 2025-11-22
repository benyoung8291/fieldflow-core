import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAcumaticaCredentials } from "../_shared/vault-credentials.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { expenseId } = await req.json();

    console.log("Syncing expense to Acumatica:", expenseId);

    // Fetch expense with related data
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select("*, vendor:suppliers(*)")
      .eq("id", expenseId)
      .single();

    if (expenseError || !expense) {
      throw new Error("Expense not found");
    }

    // Check if already synced
    if (expense.external_reference) {
      console.log("Expense already synced:", expense.external_reference);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Expense already synced",
          external_reference: expense.external_reference 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch integration settings
    const { data: integration } = await supabase
      .from("accounting_integrations")
      .select("*")
      .eq("tenant_id", expense.tenant_id)
      .eq("provider", "myob_acumatica")
      .eq("is_enabled", true)
      .single();

    if (!integration) {
      throw new Error("Acumatica integration not configured");
    }

    const { acumatica_instance_url: instanceUrl, acumatica_company_name: companyName } = integration;

    // Get credentials from vault
    const credentials = await getAcumaticaCredentials(supabase, integration.id);

    // Authenticate with Acumatica
    const authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: credentials.username,
        password: credentials.password,
        company: companyName,
      }),
    });

    if (!authResponse.ok) {
      throw new Error("Failed to authenticate with Acumatica");
    }

    const cookies = authResponse.headers.get("set-cookie");
    if (!cookies) {
      throw new Error("No authentication cookies received");
    }

    // Get vendor details
    const { data: vendor } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", expense.supplier_id)
      .single();

    // Create AP Bill in Acumatica
    const acumaticaBill = {
      Type: { value: "Bill" },
      VendorID: { value: vendor?.acumatica_supplier_id || vendor?.name?.substring(0, 30) || "VENDOR" },
      Date: { value: expense.expense_date },
      VendorRef: { value: expense.expense_number },
      Description: { value: expense.description || `Expense ${expense.expense_number}` },
      Details: [
        {
          Account: { value: expense.account_code || "5000" },
          SubAccount: expense.sub_account ? { value: expense.sub_account } : undefined,
          TransactionDescription: { value: expense.description || "" },
          Amount: { value: parseFloat(expense.amount) },
        },
      ],
    };

    const createBillResponse = await fetch(
      `${instanceUrl}/entity/Default/20.200.001/Bill`,
      {
        method: "PUT",
        headers: {
          "Cookie": cookies,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(acumaticaBill),
      }
    );

    if (!createBillResponse.ok) {
      const errorText = await createBillResponse.text();
      console.error("Failed to create AP Bill in Acumatica:", errorText);
      
      // Update expense with error
      await supabase
        .from("expenses")
        .update({
          sync_status: "error",
          sync_error: `Acumatica sync failed: ${errorText}`,
        })
        .eq("id", expenseId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create bill in Acumatica: ${errorText}` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const createdBill = await createBillResponse.json();
    const externalReference = createdBill.ReferenceNbr?.value;

    console.log("Successfully created AP Bill in Acumatica:", externalReference);

    // Logout from Acumatica
    await fetch(`${instanceUrl}/entity/auth/logout`, {
      method: "POST",
      headers: { "Cookie": cookies },
    });

    // Update expense with sync status
    await supabase
      .from("expenses")
      .update({
        sync_status: "synced",
        external_reference: externalReference,
        last_synced_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq("id", expenseId);

    // Log sync
    await supabase.from("integration_sync_logs").insert({
      tenant_id: expense.tenant_id,
      integration_id: integration.id,
      sync_type: "expense",
      status: "success",
      external_reference: externalReference,
      request_data: acumaticaBill,
      response_data: createdBill,
    });

    console.log("Expense synced successfully:", externalReference);

    return new Response(
      JSON.stringify({ 
        success: true, 
        external_reference: externalReference 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing expense to Acumatica:", error);

    // Try to update expense with error
    try {
      const { expenseId } = await req.json();
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("expenses")
          .update({
            sync_status: "error",
            sync_error: error instanceof Error ? error.message : String(error),
          })
          .eq("id", expenseId);
      }
    } catch (updateError) {
      console.error("Failed to update expense with error:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
