import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Sync AP invoices to Acumatica as Bills using session-based authentication
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoice_id } = await req.json();
    
    if (!invoice_id) {
      throw new Error('invoice_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Syncing AP invoice to Acumatica:', invoice_id);

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('invoice_type', 'ap')
      .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('Invoice not found');

    // Get supplier separately
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('name, acumatica_supplier_id, payment_terms')
      .eq('id', invoice.supplier_id)
      .maybeSingle();

    if (supplierError) throw supplierError;

    // Get line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('item_order');

    if (lineItemsError) throw lineItemsError;

    // Get accounting integration settings
    const { data: integration, error: integrationError } = await supabase
      .from('accounting_integrations')
      .select('*')
      .eq('tenant_id', invoice.tenant_id)
      .eq('provider', 'myob_acumatica')
      .eq('is_enabled', true)
      .single();

    if (integrationError || !integration) {
      throw new Error('Acumatica integration not configured or not enabled');
    }

    // Validate required fields
    if (!supplier) {
      throw new Error('Supplier not found for this invoice');
    }

    if (!supplier.acumatica_supplier_id) {
      throw new Error('Supplier does not have an Acumatica Supplier ID mapped. Please ensure the supplier record has been synced to Acumatica.');
    }

    if (!lineItems || lineItems.length === 0) {
      throw new Error('Invoice has no line items');
    }

    // Format payment terms
    const paymentTermsDays = supplier.payment_terms || 30;
    const terms = `NET${paymentTermsDays}DAYS`;

    // Calculate due date
    const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);

    // Build Details array from line items
    const details = lineItems.map(item => ({
      Branch: { value: "PREMREST" },
      InventoryID: { value: "CLEANING" },
      Qty: { value: item.quantity },
      UOM: { value: "EACH" },
      UnitCost: { value: item.unit_price },
      TransactionDescription: { value: item.description || "" },
      Account: { value: item.account_code || integration.default_sales_account_code || "53000" },
      Subaccount: { value: item.sub_account || integration.default_sales_sub_account || "FL000" }
    }));

    // Build Bill payload
    // VendorRef must be unique per vendor in Acumatica - use supplier invoice number or fall back to unique invoice ID
    const vendorRef = invoice.supplier_invoice_number && invoice.supplier_invoice_number.trim() 
      ? invoice.supplier_invoice_number 
      : `${invoice.invoice_number}-${invoice_id.substring(0, 8)}`;
    
    const billPayload = {
      Type: { value: "Bill" },
      ReferenceNbr: { value: "<NEW>" },
      Vendor: { value: supplier.acumatica_supplier_id },
      VendorRef: { value: vendorRef },
      LinkAPAccount: { value: "28000" },
      Project: { value: "X" },
      Date: { value: invoiceDate.toISOString() },
      Description: { value: `${invoice.invoice_number} ${supplier.name}`.substring(0, 255) },
      Terms: { value: terms },
      DueDate: { value: invoice.due_date ? new Date(invoice.due_date).toISOString() : dueDate.toISOString() },
      Hold: { value: true },
      Details: details
    };

    console.log('Sending Bill to Acumatica:', JSON.stringify(billPayload, null, 2));

    const baseUrl = integration.acumatica_instance_url?.replace(/\/$/, '') || '';
    let cookies: string | null = null;

    try {
      // Authenticate with Acumatica (with retry for concurrent session limits)
      let authResponse: Response | null = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        console.log(`Attempting authentication... (attempt ${retryCount + 1})`);
        authResponse = await fetch(`${baseUrl}/entity/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: integration.acumatica_username,
            password: integration.acumatica_password,
            company: integration.acumatica_company_name,
          }),
        });

        console.log('Auth response status:', authResponse.status);

        if (authResponse.ok) {
          break; // Success - exit retry loop
        }

        const errorText = await authResponse.text();
        console.error('Acumatica auth failed:', authResponse.status, errorText);

        // Check for concurrent session limit error
        if (errorText.includes('concurrent') || errorText.includes('session limit')) {
          if (retryCount < maxRetries - 1) {
            console.log('Concurrent session limit hit, waiting 2s before retry...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            retryCount++;
            continue;
          } else {
            throw new Error('Acumatica concurrent session limit reached. Please wait a few minutes and try again.');
          }
        }

        throw new Error(`Failed to authenticate with Acumatica: ${authResponse.status} - ${errorText}`);
      }

      if (!authResponse || !authResponse.ok) {
        throw new Error('Failed to authenticate after retries');
      }

      // Get cookies from authentication response
      const setCookieHeaders = authResponse.headers.getSetCookie?.() || [];
      if (setCookieHeaders.length === 0) {
        const singleCookie = authResponse.headers.get('set-cookie');
        if (singleCookie) {
          setCookieHeaders.push(singleCookie);
        }
      }

      if (setCookieHeaders.length === 0) {
        console.error('No authentication cookies received');
        throw new Error('No authentication cookies received from Acumatica');
      }

      cookies = setCookieHeaders
        .map(cookie => cookie.split(';')[0])
        .join('; ');

      console.log('Authentication successful, cookies received');

      // Send Bill to Acumatica with cookies
      const apiUrl = `${baseUrl}/entity/Default/23.200.001/Bill`;
      const acumaticaResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(billPayload)
      });

      if (!acumaticaResponse.ok) {
        const errorText = await acumaticaResponse.text();
        console.error('Acumatica API error:', errorText);
        throw new Error(`Acumatica API error: ${acumaticaResponse.status} - ${errorText}`);
      }

      const acumaticaData = await acumaticaResponse.json();
      console.log('Acumatica response:', JSON.stringify(acumaticaData, null, 2));

      // Extract the Bill ID and ReferenceNbr from response
      const billId = acumaticaData.id;
      const billReferenceNbr = acumaticaData.ReferenceNbr?.value;

      // Update invoice with Acumatica references
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          acumatica_invoice_id: billId,
          acumatica_reference_nbr: billReferenceNbr,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          sync_error: null
        })
        .eq('id', invoice_id);

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        throw updateError;
      }

      // Log sync to integration_sync_logs
      await supabase
        .from('integration_sync_logs')
        .insert({
          tenant_id: invoice.tenant_id,
          integration_id: integration.id,
          invoice_id: invoice_id,
          sync_type: 'ap_bill_create',
          status: 'success',
          external_reference: billReferenceNbr,
          request_data: billPayload,
          response_data: acumaticaData,
          synced_at: new Date().toISOString()
        });

      console.log('Successfully synced AP invoice to Acumatica Bill:', billReferenceNbr);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'AP Invoice synced to Acumatica successfully',
          bill_id: billId,
          bill_reference: billReferenceNbr
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } finally {
      // Always logout to prevent session accumulation
      if (cookies) {
        try {
          console.log('Logging out from Acumatica...');
          await fetch(`${baseUrl}/entity/auth/logout`, {
            method: 'POST',
            headers: {
              'Cookie': cookies,
            },
          });
          console.log('Logout successful');
        } catch (logoutError) {
          console.error('Logout failed (non-critical):', logoutError);
        }
      }
    }

  } catch (error: any) {
    console.error('Error syncing AP invoice to Acumatica:', error);

    // Try to update invoice with error
    if (error.invoice_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('invoices')
        .update({
          sync_status: 'failed',
          sync_error: error.message
        })
        .eq('id', error.invoice_id);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to sync AP invoice to Acumatica'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
