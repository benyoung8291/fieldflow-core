import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Get invoice with supplier and line items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        supplier:suppliers(
          name,
          acumatica_supplier_id,
          payment_terms
        )
      `)
      .eq('id', invoice_id)
      .eq('invoice_type', 'ap')
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('Invoice not found');

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
    if (!invoice.supplier?.acumatica_supplier_id) {
      throw new Error('Supplier does not have an Acumatica Supplier ID mapped. Please ensure the supplier record has been synced to Acumatica.');
    }

    if (!lineItems || lineItems.length === 0) {
      throw new Error('Invoice has no line items');
    }

    // Format payment terms
    const paymentTermsDays = invoice.supplier.payment_terms || 30;
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
    const billPayload = {
      Type: { value: "Bill" },
      ReferenceNbr: { value: "<NEW>" },
      Vendor: { value: invoice.supplier.acumatica_supplier_id },
      VendorRef: { value: invoice.supplier_invoice_number || invoice.invoice_number },
      LocationID: { value: "MAIN" },
      LinkAPAccount: { value: "28000" },
      Project: { value: "X" },
      Date: { value: invoiceDate.toISOString() },
      Description: { value: `${invoice.invoice_number} - ${invoice.description || ''}`.substring(0, 255) },
      Terms: { value: terms },
      DueDate: { value: dueDate.toISOString() },
      Hold: { value: true },
      Details: details
    };

    console.log('Sending Bill to Acumatica:', JSON.stringify(billPayload, null, 2));

    // Prepare authentication
    const authString = btoa(`${integration.acumatica_username}:${integration.acumatica_password}`);
    const baseUrl = integration.acumatica_instance_url?.replace(/\/$/, '') || '';
    const apiUrl = `${baseUrl}/entity/Default/23.200.001/Bill`;

    // Send to Acumatica
    const acumaticaResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${authString}`,
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
