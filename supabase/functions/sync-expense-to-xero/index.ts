import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getXeroCredentials, updateXeroTokens } from "../_shared/vault-credentials.ts";

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

    console.log("Syncing expense to Xero:", expenseId);

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
      .eq("provider", "xero")
      .eq("is_enabled", true)
      .single();

    if (!integration || !integration.xero_tenant_id) {
      throw new Error("Xero integration not configured");
    }

    // Get credentials from vault
    const credentials = await getXeroCredentials(supabase, integration.id);

    // Check if token needs refresh
    let accessToken = credentials.access_token;
    if (integration.xero_token_expires_at) {
      const expiresAt = new Date(integration.xero_token_expires_at);
      if (expiresAt <= new Date()) {
        // Refresh access token
        const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${integration.xero_client_id}:${credentials.client_secret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: credentials.refresh_token,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to refresh Xero access token");
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;

        // Update tokens in vault
        await updateXeroTokens(supabase, integration.id, tokenData.access_token, tokenData.refresh_token);
        await supabase
          .from("accounting_integrations")
          .update({
            xero_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          })
          .eq("id", integration.id);
      }
    }

    // Fetch contact (vendor) in Xero
    let contactId = null;
    if (expense.vendor) {
      const contactsResponse = await fetch(
        `https://api.xero.com/api.xro/2.0/Contacts?where=Name=="${encodeURIComponent(expense.vendor.name)}"`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "xero-tenant-id": integration.xero_tenant_id,
            "Accept": "application/json",
          },
        }
      );

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        if (contactsData.Contacts && contactsData.Contacts.length > 0) {
          contactId = contactsData.Contacts[0].ContactID;
        }
      }

      // Create contact if not found
      if (!contactId) {
        const createContactResponse = await fetch(
          "https://api.xero.com/api.xro/2.0/Contacts",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "xero-tenant-id": integration.xero_tenant_id,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({
              Contacts: [{
                Name: expense.vendor.name,
                EmailAddress: expense.vendor.email || undefined,
                IsSupplier: true,
              }],
            }),
          }
        );

        if (createContactResponse.ok) {
          const createContactData = await createContactResponse.json();
          contactId = createContactData.Contacts[0].ContactID;
        }
      }
    }

    // Create Bill (AP Invoice) in Xero
    const billData = {
      Invoices: [
        {
          Type: "ACCPAY", // Accounts Payable
          Contact: contactId ? { ContactID: contactId } : { Name: "Supplier" },
          Date: expense.expense_date,
          DueDate: expense.expense_date,
          InvoiceNumber: expense.expense_number,
          Reference: expense.reference_number || undefined,
          Status: "AUTHORISED",
          LineItems: [
            {
              Description: expense.description,
              Quantity: 1,
              UnitAmount: parseFloat(expense.amount),
              AccountCode: expense.account_code || "400", // Default expense account
              TaxType: "NONE", // Adjust based on GST requirements
            },
          ],
        },
      ],
    };

    const createBillResponse = await fetch(
      "https://api.xero.com/api.xro/2.0/Invoices",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "xero-tenant-id": integration.xero_tenant_id,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(billData),
      }
    );

    if (!createBillResponse.ok) {
      const errorText = await createBillResponse.text();
      throw new Error(`Failed to create Bill in Xero: ${errorText}`);
    }

    const createdBill = await createBillResponse.json();
    const externalReference = createdBill.Invoices[0].InvoiceID;

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
      request_data: billData,
      response_data: createdBill,
    });

    console.log("Expense synced successfully to Xero:", externalReference);

    return new Response(
      JSON.stringify({ 
        success: true, 
        external_reference: externalReference 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing expense to Xero:", error);

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
