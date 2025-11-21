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
        let result: any;
        
        if (integration.provider === "myob_acumatica") {
          result = await syncToAcumatica(invoice, integration);
          
          // Update invoice with Acumatica details
          await supabaseClient
            .from("invoices")
            .update({
              acumatica_invoice_id: result.acumatica_invoice_id,
              acumatica_reference_nbr: result.acumatica_reference_nbr,
              acumatica_status: result.acumatica_status,
              synced_to_accounting_at: new Date().toISOString(),
            })
            .eq("id", invoice_id);
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
          ...(result?.acumatica_invoice_id && {
            acumatica_invoice_id: result.acumatica_invoice_id,
            acumatica_reference_nbr: result.acumatica_reference_nbr,
          }),
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
  const username = integration.acumatica_username;
  const password = integration.acumatica_password;
  
  if (!username || !password) {
    throw new Error("Acumatica credentials not configured in integration settings");
  }

  console.log("Syncing AR invoice to Acumatica:", {
    instanceUrl: integration.acumatica_instance_url,
    companyName: integration.acumatica_company_name,
    invoiceNumber: invoice.invoice_number,
    customerId: invoice.customers?.acumatica_customer_id
  });

  // Remove trailing slash from instance URL if present
  const instanceUrl = integration.acumatica_instance_url.replace(/\/$/, '');

  // Authenticate with retry logic for concurrent session limits
  let authResponse: Response | null = null;
  let retryCount = 0;
  const maxRetries = 2;
  const retryDelay = 2000; // 2 seconds

  while (retryCount <= maxRetries) {
    console.log(`Attempting Acumatica authentication (attempt ${retryCount + 1})...`);
    
    authResponse = await fetch(`${instanceUrl}/entity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: username,
        password: password,
        company: integration.acumatica_company_name,
      }),
    });

    console.log("Auth response:", { status: authResponse.status });

    if (!authResponse.ok) {
      const authErrorText = await authResponse.text();
      console.error("Acumatica authentication failed:", authErrorText);
      
      // Check for concurrent login limit error
      if (authErrorText.includes("concurrent API logins")) {
        if (retryCount < maxRetries) {
          console.log(`Concurrent session limit hit, waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
          continue; // Retry
        }
      }
      
      throw new Error(`Failed to authenticate with Acumatica (${authResponse.status}): ${authErrorText || authResponse.statusText}`);
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
    throw new Error("No authentication cookies received from Acumatica");
  }

  // Join all cookies into a single Cookie header value
  const cookies = setCookieHeaders
    .map(cookie => cookie.split(';')[0]) // Take only the name=value part
    .join('; ');
  
  console.log("Authentication successful, cookies parsed:", cookies.substring(0, 100) + "...");

  // Get customer's Acumatica ID
  const customerId = invoice.customers?.acumatica_customer_id;
  if (!customerId) {
    await fetch(`${instanceUrl}/entity/auth/logout`, {
      method: "POST",
      headers: { "Cookie": cookies },
    });
    throw new Error("Customer does not have an Acumatica customer ID mapped. Please ensure the customer record has been synced to Acumatica.");
  }

  console.log("Using Acumatica Customer ID:", customerId);

  // Prepare invoice description with invoice number prefix
  const description = `${invoice.invoice_number} - ${invoice.description || 'Invoice'}`;

  // Build line items
  const lineItems = invoice.invoice_line_items?.map((item: any) => {
    return {
      Branch: { value: "PREMREST" },
      InventoryID: { value: "CLEANING" },
      Qty: { value: parseFloat(item.quantity) },
      UOM: { value: "EACH" },
      UnitPrice: { value: parseFloat(item.unit_price) },
      TransactionDescription: { value: item.description || "" },
      Account: { value: item.account_code || integration.default_sales_account_code },
      Subaccount: { value: item.sub_account || integration.default_sales_sub_account },
    };
  }) || [];

  // Build Acumatica invoice payload - exactly matching the user's working example
  const acumaticaInvoice = {
    Type: { value: "Invoice" },
    ReferenceNbr: { value: "<NEW>" },
    Customer: { value: customerId },  // Use Customer, not CustomerID
    LocationID: { value: "MAIN" },
    LinkARAccount: { value: "16100" },
    Project: { value: "X" },
    Date: { value: invoice.invoice_date },
    Description: { value: description },
    Terms: { value: "NET30DAYS" },
    DiscountDate: { value: invoice.invoice_date },
    DueDate: { value: invoice.due_date || invoice.invoice_date },
    Hold: { value: true },
    Details: lineItems,
  };

  console.log("Creating invoice in Acumatica with payload:", JSON.stringify(acumaticaInvoice, null, 2));

  // Wait a moment to ensure session is fully established
  await new Promise(resolve => setTimeout(resolve, 500));

  const invoiceResponse = await fetch(
    `${instanceUrl}/entity/Default/20.200.001/SalesInvoice`,
    {
      method: "PUT",
      headers: {
        "Cookie": cookies,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(acumaticaInvoice),
    }
  );

  console.log("Invoice response status:", invoiceResponse.status);

  if (!invoiceResponse.ok) {
    const errorText = await invoiceResponse.text();
    console.error("Acumatica invoice creation failed:", {
      status: invoiceResponse.status,
      statusText: invoiceResponse.statusText,
      error: errorText,
      payload: acumaticaInvoice,
    });
    
    // Logout even on error
    await fetch(`${instanceUrl}/entity/auth/logout`, {
      method: "POST",
      headers: { "Cookie": cookies },
    });
    
    throw new Error(`Failed to create invoice in Acumatica (${invoiceResponse.status}): ${errorText || invoiceResponse.statusText}`);
  }

  const createdInvoice = await invoiceResponse.json();
  console.log("Successfully created Acumatica invoice:", createdInvoice);

  // Logout after success
  await fetch(`${instanceUrl}/entity/auth/logout`, {
    method: "POST",
    headers: { "Cookie": cookies },
  });

  // Extract ID and ReferenceNbr
  const acumaticaInvoiceId = createdInvoice.id?.value;
  const referenceNbr = createdInvoice.ReferenceNbr?.value;

  console.log("Acumatica invoice created:", { id: acumaticaInvoiceId, referenceNbr });
  
  return {
    external_id: referenceNbr,
    acumatica_invoice_id: acumaticaInvoiceId,
    acumatica_reference_nbr: referenceNbr,
    acumatica_status: "Balanced",
    response: createdInvoice,
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
