import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const username = Deno.env.get("ACUMATICA_USERNAME");
    const password = Deno.env.get("ACUMATICA_PASSWORD");

    if (!supabaseUrl || !supabaseKey || !username || !password) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { expenseId } = await req.json();

    console.log("Syncing expense to Acumatica:", expenseId);

    // Fetch expense with related data
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select("*, vendor:vendors(*)")
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
      .eq("provider", "acumatica")
      .eq("is_enabled", true)
      .single();

    if (!integration) {
      throw new Error("Acumatica integration not configured");
    }

    const { acumatica_instance_url: instanceUrl, acumatica_company_name: companyName } = integration;

    // Authenticate with Acumatica
    const authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: username,
        password: password,
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

    // Create AP Invoice in Acumatica
    const apInvoiceData = {
      Type: { value: "Invoice" },
      ReferenceNbr: { value: expense.expense_number },
      Date: { value: expense.expense_date },
      Vendor: { value: expense.vendor?.abn || "VENDOR" }, // Use vendor code
      Description: { value: expense.description },
      Details: [
        {
          Account: { value: expense.account_code || "5000" },
          SubAccount: expense.sub_account ? { value: expense.sub_account } : undefined,
          TransactionDescription: { value: expense.description },
          Amount: { value: parseFloat(expense.amount) },
        },
      ],
    };

    const createInvoiceResponse = await fetch(
      `${instanceUrl}/entity/Default/20.200.001/Bill`,
      {
        method: "PUT",
        headers: {
          "Cookie": cookies,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(apInvoiceData),
      }
    );

    if (!createInvoiceResponse.ok) {
      const errorText = await createInvoiceResponse.text();
      throw new Error(`Failed to create AP Invoice: ${errorText}`);
    }

    const createdInvoice = await createInvoiceResponse.json();
    const externalReference = createdInvoice.ReferenceNbr?.value || createdInvoice.id;

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
      request_data: apInvoiceData,
      response_data: createdInvoice,
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
