import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAcumaticaCredentials } from "../_shared/vault-credentials.ts";

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
    let invoiceType: 'ar' | 'ap' | null = null;
    try {
      const body = await req.json();
      specificInvoiceId = body?.invoice_id || null;
      invoiceType = body?.invoice_type || null; // 'ar' or 'ap'
    } catch {
      // No body or invalid JSON - process all invoices
    }

    if (specificInvoiceId) {
      console.log(`Manual sync requested for ${invoiceType || 'all'} invoice: ${specificInvoiceId}`);
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

      // Get credentials from vault
      const credentials = await getAcumaticaCredentials(supabase, integration.id);

      // Authenticate with Acumatica once per tenant
      console.log(`Authenticating with Acumatica for tenant ${integration.tenant_id}`);
      
      const authResponse = await fetch(`${integration.acumatica_instance_url}/entity/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: credentials.username,
          password: credentials.password,
          company: integration.acumatica_company_name,
        }),
      });

      if (!authResponse.ok) {
        console.error(`Failed to authenticate with Acumatica: ${authResponse.status}`);
        results.push({
          tenant_id: integration.tenant_id,
          status: 'error',
          error: 'Authentication failed',
        });
        continue;
      }

      // Get authentication cookies
      const setCookieHeaders = authResponse.headers.getSetCookie?.() || [];
      if (setCookieHeaders.length === 0) {
        const singleCookie = authResponse.headers.get("set-cookie");
        if (singleCookie) {
          setCookieHeaders.push(singleCookie);
        }
      }
      
      if (setCookieHeaders.length === 0) {
        console.error("No authentication cookies received");
        results.push({
          tenant_id: integration.tenant_id,
          status: 'error',
          error: 'No authentication cookies',
        });
        continue;
      }

      const cookies = setCookieHeaders
        .map(cookie => cookie.split(';')[0])
        .join('; ');

      console.log("Authentication successful");

      let arUpdatedCount = 0;
      let arErrorCount = 0;
      let apUpdatedCount = 0;
      let apErrorCount = 0;

      // ==================== PROCESS AR INVOICES ====================
      if (!invoiceType || invoiceType === 'ar') {
        // Build query for AR invoices
        let arQuery = supabase
          .from('invoices')
          .select('id, invoice_number, acumatica_invoice_id, acumatica_reference_nbr, acumatica_status, status, tenant_id')
          .eq('tenant_id', integration.tenant_id)
          .or('acumatica_invoice_id.not.is.null,acumatica_reference_nbr.not.is.null');

        if (specificInvoiceId && invoiceType === 'ar') {
          arQuery = arQuery.eq('id', specificInvoiceId);
        }

        const { data: arInvoices, error: arInvoicesError } = await arQuery;

        if (arInvoicesError) {
          console.error(`Error fetching AR invoices for tenant ${integration.tenant_id}:`, arInvoicesError);
          arErrorCount++;
        } else {
          console.log(`Found ${arInvoices?.length || 0} synced AR invoices for tenant ${integration.tenant_id}`);

          // Process AR invoices
          for (const invoice of arInvoices || []) {
            try {
              const result = await processArInvoice(invoice, integration, cookies, supabase);
              if (result.updated) arUpdatedCount++;
            } catch (invoiceError) {
              console.error(`Error processing AR invoice ${invoice.invoice_number}:`, invoiceError);
              arErrorCount++;
            }
          }
        }
      }

      // ==================== PROCESS AP INVOICES (BILLS) ====================
      if (!invoiceType || invoiceType === 'ap') {
        // Build query for AP invoices
        let apQuery = supabase
          .from('ap_invoices')
          .select('id, invoice_number, acumatica_invoice_id, acumatica_reference_nbr, acumatica_status, status, tenant_id')
          .eq('tenant_id', integration.tenant_id)
          .or('acumatica_invoice_id.not.is.null,acumatica_reference_nbr.not.is.null');

        if (specificInvoiceId && invoiceType === 'ap') {
          apQuery = apQuery.eq('id', specificInvoiceId);
        }

        const { data: apInvoices, error: apInvoicesError } = await apQuery;

        if (apInvoicesError) {
          console.error(`Error fetching AP invoices for tenant ${integration.tenant_id}:`, apInvoicesError);
          apErrorCount++;
        } else {
          console.log(`Found ${apInvoices?.length || 0} synced AP invoices for tenant ${integration.tenant_id}`);

          // Process AP invoices (Bills)
          for (const invoice of apInvoices || []) {
            try {
              const result = await processApInvoice(invoice, integration, cookies, supabase);
              if (result.updated) apUpdatedCount++;
            } catch (invoiceError) {
              console.error(`Error processing AP invoice ${invoice.invoice_number}:`, invoiceError);
              apErrorCount++;
            }
          }
        }
      }

      // Logout after processing all invoices for this tenant
      await fetch(`${integration.acumatica_instance_url}/entity/auth/logout`, {
        method: "POST",
        headers: { "Cookie": cookies },
      });

      results.push({
        tenant_id: integration.tenant_id,
        status: 'success',
        ar_invoices: {
          updated_count: arUpdatedCount,
          error_count: arErrorCount,
        },
        ap_invoices: {
          updated_count: apUpdatedCount,
          error_count: apErrorCount,
        },
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

// Process AR Invoice status from Acumatica
async function processArInvoice(invoice: any, integration: any, cookies: string, supabase: any): Promise<{ updated: boolean }> {
  let acumaticaInvoice;
  let acumaticaInvoiceId = invoice.acumatica_invoice_id;

  // If we have invoice_id, use direct lookup
  if (invoice.acumatica_invoice_id) {
    console.log(`Checking AR status for invoice ${invoice.invoice_number} using ID: ${invoice.acumatica_invoice_id}`);
    
    const acumaticaUrl = `${integration.acumatica_instance_url}/entity/Default/23.200.001/Invoice/${invoice.acumatica_invoice_id}`;
    const response = await fetch(acumaticaUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch AR invoice ${invoice.invoice_number} from Acumatica: ${response.status}`);
      throw new Error(`Failed to fetch invoice: ${response.status}`);
    }

    acumaticaInvoice = await response.json();
  } 
  // If we only have reference_nbr, use filter query
  else if (invoice.acumatica_reference_nbr) {
    console.log(`Checking AR status for invoice ${invoice.invoice_number} using filter ReferenceNbr: ${invoice.acumatica_reference_nbr}`);
    
    const filterUrl = `${integration.acumatica_instance_url}/entity/Default/23.200.001/Invoice?$filter=ReferenceNbr eq '${invoice.acumatica_reference_nbr}'`;
    const response = await fetch(filterUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch AR invoice ${invoice.invoice_number} from Acumatica: ${response.status}`);
      throw new Error(`Failed to fetch invoice: ${response.status}`);
    }

    const results = await response.json();
    if (!results || results.length === 0) {
      console.error(`No AR invoice found in Acumatica with ReferenceNbr ${invoice.acumatica_reference_nbr}`);
      throw new Error('Invoice not found in Acumatica');
    }

    acumaticaInvoice = results[0];
    acumaticaInvoiceId = acumaticaInvoice.id;
    console.log(`Found AR invoice via filter, ID: ${acumaticaInvoiceId}`);
  } else {
    console.log(`Skipping AR invoice ${invoice.invoice_number} - no Acumatica identifier found`);
    return { updated: false };
  }

  const acumaticaStatus = acumaticaInvoice.Status?.value;
  
  console.log(`AR Invoice ${invoice.invoice_number} - Acumatica status: ${acumaticaStatus}, Current app status: ${invoice.status}`);

  // Determine if we need to update the local invoice
  let shouldUpdate = false;
  let newStatus = invoice.status;
  let auditNote = '';

  // Status mapping:
  // Acumatica "Closed" -> App "paid"
  // Acumatica "Deleted"/"Voided"/"Reversed" -> App "draft" (unapproved)
  if (acumaticaStatus === 'Closed' && invoice.status !== 'paid') {
    newStatus = 'paid';
    shouldUpdate = true;
    auditNote = 'Invoice marked as paid - synced from MYOB Acumatica (status: Closed)';
    console.log(`AR Invoice ${invoice.invoice_number} is Closed in Acumatica - updating to paid`);
  } else if ((acumaticaStatus === 'Deleted' || acumaticaStatus === 'Voided' || acumaticaStatus === 'Reversed') && invoice.status !== 'draft') {
    newStatus = 'draft';
    shouldUpdate = true;
    auditNote = `Invoice unapproved - ${acumaticaStatus.toLowerCase()} in MYOB Acumatica`;
    console.log(`AR Invoice ${invoice.invoice_number} is ${acumaticaStatus} in Acumatica - updating to draft`);
  }

  // Always update acumatica_status if it changed
  if (invoice.acumatica_status !== acumaticaStatus) {
    shouldUpdate = true;
    if (!auditNote) {
      auditNote = `Acumatica status changed from ${invoice.acumatica_status || 'none'} to ${acumaticaStatus}`;
    }
  }

  if (shouldUpdate) {
    const updateData: any = {
      status: newStatus,
      acumatica_status: acumaticaStatus,
    };
    
    // Update invoice_id if we didn't have it before
    if (!invoice.acumatica_invoice_id && acumaticaInvoiceId) {
      updateData.acumatica_invoice_id = acumaticaInvoiceId;
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (updateError) {
      console.error(`Error updating AR invoice ${invoice.invoice_number}:`, updateError);
      throw updateError;
    }

    console.log(`Successfully updated AR invoice ${invoice.invoice_number} - Status: ${newStatus}, Acumatica Status: ${acumaticaStatus}`);
    
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
    
    return { updated: true };
  }

  return { updated: false };
}

// Process AP Invoice (Bill) status from Acumatica
async function processApInvoice(invoice: any, integration: any, cookies: string, supabase: any): Promise<{ updated: boolean }> {
  let acumaticaBill;
  let acumaticaInvoiceId = invoice.acumatica_invoice_id;

  // If we have invoice_id, use direct lookup
  if (invoice.acumatica_invoice_id) {
    console.log(`Checking AP status for invoice ${invoice.invoice_number} using ID: ${invoice.acumatica_invoice_id}`);
    
    const acumaticaUrl = `${integration.acumatica_instance_url}/entity/Default/23.200.001/Bill/${invoice.acumatica_invoice_id}`;
    const response = await fetch(acumaticaUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch AP invoice ${invoice.invoice_number} from Acumatica: ${response.status}`);
      throw new Error(`Failed to fetch bill: ${response.status}`);
    }

    acumaticaBill = await response.json();
  } 
  // If we only have reference_nbr, use filter query
  else if (invoice.acumatica_reference_nbr) {
    console.log(`Checking AP status for invoice ${invoice.invoice_number} using filter ReferenceNbr: ${invoice.acumatica_reference_nbr}`);
    
    const filterUrl = `${integration.acumatica_instance_url}/entity/Default/23.200.001/Bill?$filter=ReferenceNbr eq '${invoice.acumatica_reference_nbr}'`;
    const response = await fetch(filterUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch AP invoice ${invoice.invoice_number} from Acumatica: ${response.status}`);
      throw new Error(`Failed to fetch bill: ${response.status}`);
    }

    const results = await response.json();
    if (!results || results.length === 0) {
      console.error(`No AP invoice found in Acumatica with ReferenceNbr ${invoice.acumatica_reference_nbr}`);
      throw new Error('Bill not found in Acumatica');
    }

    acumaticaBill = results[0];
    acumaticaInvoiceId = acumaticaBill.id;
    console.log(`Found AP invoice via filter, ID: ${acumaticaInvoiceId}`);
  } else {
    console.log(`Skipping AP invoice ${invoice.invoice_number} - no Acumatica identifier found`);
    return { updated: false };
  }

  const acumaticaStatus = acumaticaBill.Status?.value;
  
  console.log(`AP Invoice ${invoice.invoice_number} - Acumatica status: ${acumaticaStatus}, Current app status: ${invoice.status}`);

  // Determine if we need to update the local invoice
  let shouldUpdate = false;
  let newStatus = invoice.status;
  let auditNote = '';

  // Status mapping for AP/Bills:
  // Acumatica "Closed" -> App "paid"
  // Acumatica "Deleted"/"Voided"/"Reversed" -> App "draft" (unapproved)
  if (acumaticaStatus === 'Closed' && invoice.status !== 'paid') {
    newStatus = 'paid';
    shouldUpdate = true;
    auditNote = 'AP Invoice marked as paid - synced from MYOB Acumatica (status: Closed)';
    console.log(`AP Invoice ${invoice.invoice_number} is Closed in Acumatica - updating to paid`);
  } else if ((acumaticaStatus === 'Deleted' || acumaticaStatus === 'Voided' || acumaticaStatus === 'Reversed') && invoice.status !== 'draft') {
    newStatus = 'draft';
    shouldUpdate = true;
    auditNote = `AP Invoice unapproved - ${acumaticaStatus.toLowerCase()} in MYOB Acumatica`;
    console.log(`AP Invoice ${invoice.invoice_number} is ${acumaticaStatus} in Acumatica - updating to draft`);
  }

  // Always update acumatica_status if it changed
  if (invoice.acumatica_status !== acumaticaStatus) {
    shouldUpdate = true;
    if (!auditNote) {
      auditNote = `Acumatica status changed from ${invoice.acumatica_status || 'none'} to ${acumaticaStatus}`;
    }
  }

  if (shouldUpdate) {
    const updateData: any = {
      status: newStatus,
      acumatica_status: acumaticaStatus,
    };
    
    // Update invoice_id if we didn't have it before
    if (!invoice.acumatica_invoice_id && acumaticaInvoiceId) {
      updateData.acumatica_invoice_id = acumaticaInvoiceId;
    }

    const { error: updateError } = await supabase
      .from('ap_invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (updateError) {
      console.error(`Error updating AP invoice ${invoice.invoice_number}:`, updateError);
      throw updateError;
    }

    console.log(`Successfully updated AP invoice ${invoice.invoice_number} - Status: ${newStatus}, Acumatica Status: ${acumaticaStatus}`);
    
    // Log the change to audit history
    await supabase.from('audit_logs').insert({
      tenant_id: integration.tenant_id,
      user_id: null,
      user_name: 'System (Acumatica Sync)',
      table_name: 'ap_invoices',
      record_id: invoice.id,
      action: 'update',
      field_name: 'status',
      old_value: invoice.status,
      new_value: newStatus,
      note: auditNote,
    });
    
    return { updated: true };
  }

  return { updated: false };
}
