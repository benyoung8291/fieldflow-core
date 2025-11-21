import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Acumatica invoice status sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if a specific invoice ID was provided
    let specificInvoiceId: string | null = null;
    try {
      const body = await req.json();
      specificInvoiceId = body?.invoice_id || null;
    } catch {
      // No body or invalid JSON - process all invoices
    }

    if (specificInvoiceId) {
      console.log(`Manual sync requested for invoice: ${specificInvoiceId}`);
    }

    // Get all tenants with enabled Acumatica integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('accounting_integrations')
      .select('*')
      .eq('provider', 'myob_acumatica')
      .eq('is_enabled', true);

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError);
      throw integrationsError;
    }

    console.log(`Found ${integrations?.length || 0} active Acumatica integrations`);

    const results = [];

    // Process each tenant's integration
    for (const integration of integrations || []) {
      console.log(`Processing tenant: ${integration.tenant_id}`);

      // Build query for invoices
      let query = supabase
        .from('invoices')
        .select('id, invoice_number, acumatica_reference_nbr, acumatica_status, status, tenant_id')
        .eq('tenant_id', integration.tenant_id)
        .not('acumatica_reference_nbr', 'is', null);

      // If specific invoice requested, filter to just that one
      if (specificInvoiceId) {
        query = query.eq('id', specificInvoiceId);
      }

      const { data: invoices, error: invoicesError } = await query;

      if (invoicesError) {
        console.error(`Error fetching invoices for tenant ${integration.tenant_id}:`, invoicesError);
        results.push({
          tenant_id: integration.tenant_id,
          status: 'error',
          error: invoicesError.message,
        });
        continue;
      }

      console.log(`Found ${invoices?.length || 0} synced invoices for tenant ${integration.tenant_id}`);

      let updatedCount = 0;
      let errorCount = 0;

      // Check status for each invoice
      for (const invoice of invoices || []) {
        try {
          console.log(`Checking status for invoice ${invoice.invoice_number} (Acumatica Ref: ${invoice.acumatica_reference_nbr})`);

          // Query Acumatica API for invoice status using ReferenceNbr
          const acumaticaUrl = `${integration.acumatica_instance_url}/entity/Default/23.200.001/Invoice/${invoice.acumatica_reference_nbr}`;
          const authString = btoa(`${integration.acumatica_username}:${integration.acumatica_password}`);

          const response = await fetch(acumaticaUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.error(`Failed to fetch invoice ${invoice.invoice_number} from Acumatica: ${response.status}`);
            errorCount++;
            continue;
          }

          const acumaticaInvoice = await response.json();
          const acumaticaStatus = acumaticaInvoice.Status?.value;

          console.log(`Invoice ${invoice.invoice_number} - Acumatica status: ${acumaticaStatus}, Current app status: ${invoice.status}`);

          // Determine if we need to update the local invoice
          let shouldUpdate = false;
          let newStatus = invoice.status;
          let auditNote = '';

          // Status mapping:
          // Acumatica "Closed" -> App "paid"
          // Acumatica "Deleted"/"Voided" -> App "draft" (unapproved)
          if (acumaticaStatus === 'Closed' && invoice.status !== 'paid') {
            newStatus = 'paid';
            shouldUpdate = true;
            auditNote = 'Invoice marked as paid - synced from MYOB Acumatica (status: Closed)';
            console.log(`Invoice ${invoice.invoice_number} is Closed in Acumatica - updating to paid`);
          } else if ((acumaticaStatus === 'Deleted' || acumaticaStatus === 'Voided') && invoice.status !== 'draft') {
            newStatus = 'draft';
            shouldUpdate = true;
            auditNote = `Invoice unapproved - deleted/voided in MYOB Acumatica (status: ${acumaticaStatus})`;
            console.log(`Invoice ${invoice.invoice_number} is ${acumaticaStatus} in Acumatica - updating to draft`);
          }

          // Always update acumatica_status if it changed
          if (invoice.acumatica_status !== acumaticaStatus) {
            shouldUpdate = true;
            if (!auditNote) {
              auditNote = `Acumatica status changed from ${invoice.acumatica_status || 'none'} to ${acumaticaStatus}`;
            }
          }

          if (shouldUpdate) {
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                status: newStatus,
                acumatica_status: acumaticaStatus,
              })
              .eq('id', invoice.id);

            if (updateError) {
              console.error(`Error updating invoice ${invoice.invoice_number}:`, updateError);
              errorCount++;
            } else {
              console.log(`Successfully updated invoice ${invoice.invoice_number} - Status: ${newStatus}, Acumatica Status: ${acumaticaStatus}`);
              
              // Log the change to audit history
              await supabase.from('audit_logs').insert({
                tenant_id: integration.tenant_id,
                user_id: null,
                user_name: 'System (Acumatica Sync)',
                table_name: 'invoices',
                record_id: invoice.id,
                action: 'update',
                field_name: 'status',
                old_value: invoice.status,
                new_value: newStatus,
                note: auditNote,
              });
              
              updatedCount++;
            }
          }
        } catch (invoiceError) {
          console.error(`Error processing invoice ${invoice.invoice_number}:`, invoiceError);
          errorCount++;
        }
      }

      results.push({
        tenant_id: integration.tenant_id,
        status: 'success',
        total_invoices: invoices?.length || 0,
        updated_count: updatedCount,
        error_count: errorCount,
      });
    }

    console.log('Acumatica invoice status sync completed');
    console.log('Results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice status sync completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in sync-acumatica-invoice-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
