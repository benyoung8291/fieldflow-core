import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceSyncRequest {
  invoice_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { invoice_id } = (await req.json()) as InvoiceSyncRequest;

    // Get user's tenant
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("No tenant found");

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        *,
        customers (*),
        invoice_line_items (*)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError) throw invoiceError;

    // Get enabled integrations
    const { data: integrations, error: integrationsError } = await supabaseClient
      .from("accounting_integrations")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_enabled", true);

    if (integrationsError) throw integrationsError;

    const syncResults = [];

    // Sync to each enabled integration
    for (const integration of integrations) {
      try {
        let result;
        
        if (integration.provider === "myob_acumatica") {
          result = await syncToAcumatica(invoice, integration);
        } else if (integration.provider === "xero") {
          result = await syncToXero(invoice, integration);
        }

        // Log successful sync
        await supabaseClient.from("integration_sync_logs").insert({
          tenant_id: profile.tenant_id,
          integration_id: integration.id,
          invoice_id: invoice.id,
          sync_type: "invoice",
          status: "success",
          external_reference: result?.external_id,
          response_data: result,
        });

        syncResults.push({
          provider: integration.provider,
          status: "success",
          external_id: result?.external_id,
        });
      } catch (error) {
        // Log failed sync
        await supabaseClient.from("integration_sync_logs").insert({
          tenant_id: profile.tenant_id,
          integration_id: integration.id,
          invoice_id: invoice.id,
          sync_type: "invoice",
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
        });

        syncResults.push({
          provider: integration.provider,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results: syncResults }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function syncToAcumatica(invoice: any, integration: any) {
  // Get credentials from secrets
  const username = Deno.env.get("ACUMATICA_USERNAME");
  const password = Deno.env.get("ACUMATICA_PASSWORD");

  if (!username || !password) {
    throw new Error("Acumatica credentials not configured");
  }

  const baseUrl = integration.acumatica_instance_url;
  const company = integration.acumatica_company_name;

  // Authenticate with Acumatica
  const authResponse = await fetch(`${baseUrl}/entity/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: username,
      password: password,
      company: company,
    }),
  });

  if (!authResponse.ok) {
    throw new Error("Failed to authenticate with Acumatica");
  }

  const cookies = authResponse.headers.get("set-cookie");

  // Create invoice in Acumatica
  const invoiceData = {
    Type: { value: "Invoice" },
    ReferenceNbr: { value: invoice.invoice_number },
    Date: { value: invoice.invoice_date },
    DueDate: { value: invoice.due_date },
    CustomerID: { value: invoice.customers?.name },
    Amount: { value: invoice.total_amount },
    Details: invoice.invoice_line_items.map((item: any) => ({
      Description: { value: item.description },
      Qty: { value: item.quantity },
      UnitPrice: { value: item.unit_price },
      Amount: { value: item.line_total },
    })),
  };

  const createResponse = await fetch(`${baseUrl}/entity/Default/23.200.001/SalesInvoice`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookies || "",
    },
    body: JSON.stringify(invoiceData),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create invoice in Acumatica: ${errorText}`);
  }

  const result = await createResponse.json();

  // Logout
  await fetch(`${baseUrl}/entity/auth/logout`, {
    method: "POST",
    headers: {
      "Cookie": cookies || "",
    },
  });

  return {
    external_id: result.ReferenceNbr?.value,
    response: result,
  };
}

async function syncToXero(invoice: any, integration: any) {
  // Get credentials from secrets
  const clientId = Deno.env.get("XERO_CLIENT_ID");
  const clientSecret = Deno.env.get("XERO_CLIENT_SECRET");
  const refreshToken = Deno.env.get("XERO_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Xero credentials not configured");
  }

  // Get access token
  const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to get Xero access token");
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Create invoice in Xero
  const invoiceData = {
    Type: "ACCREC",
    Contact: {
      Name: invoice.customers?.name,
    },
    Date: invoice.invoice_date,
    DueDate: invoice.due_date,
    InvoiceNumber: invoice.invoice_number,
    LineItems: invoice.invoice_line_items.map((item: any) => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.unit_price,
      LineAmount: item.line_total,
      AccountCode: "200", // Default sales account - should be configurable
    })),
    Status: "AUTHORISED",
  };

  const createResponse = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "Xero-tenant-id": integration.xero_tenant_id,
    },
    body: JSON.stringify({ Invoices: [invoiceData] }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create invoice in Xero: ${errorText}`);
  }

  const result = await createResponse.json();

  return {
    external_id: result.Invoices?.[0]?.InvoiceID,
    response: result,
  };
}
