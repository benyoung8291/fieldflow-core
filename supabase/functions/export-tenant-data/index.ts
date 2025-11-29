import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📊 Starting tenant data export...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Verify the user is authenticated
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is super_admin
    const { data: roles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      throw rolesError;
    }

    const isSuperAdmin = roles?.some(r => r.role === "super_admin");
    if (!isSuperAdmin) {
      throw new Error("Access denied. Super admin role required.");
    }

    const { tenantId } = await req.json();

    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    console.log(`🔍 Looking up tenant with ID: ${tenantId}`);

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .single();

    if (tenantError) {
      console.error("❌ Tenant query error:", tenantError);
      throw new Error(`Tenant query failed: ${tenantError.message}`);
    }

    if (!tenant) {
      console.error("❌ No tenant found with ID:", tenantId);
      throw new Error("Tenant not found");
    }

    console.log(`📦 Exporting data for tenant: ${tenant.name}`);

    // List of all tables with tenant_id
    const tables = [
      'accounting_integrations', 'ap_invoice_line_items', 'ap_invoice_settings', 'ap_invoices',
      'appointment_attachments', 'appointment_templates', 'appointment_worker_confirmations', 
      'appointment_workers', 'appointments', 'audit_logs', 'brand_colors', 'change_order_line_items',
      'chart_of_accounts_cache', 'company_credit_cards', 'contact_activities', 'contacts',
      'credit_card_transactions', 'crm_pipelines', 'crm_status_settings', 'customer_locations',
      'customer_message_templates', 'customer_portal_settings', 'customer_portal_users', 'customers',
      'document_notes', 'document_templates', 'expense_attachments', 'expense_categories',
      'expense_policy_rules', 'expenses', 'field_report_photos', 'field_reports', 'floor_plans',
      'general_settings', 'helpdesk_email_accounts', 'helpdesk_linked_documents', 'helpdesk_messages',
      'helpdesk_pipeline_users', 'helpdesk_pipelines', 'helpdesk_tickets', 'integration_sync_logs',
      'invoice_line_items', 'invoices', 'knowledge_article_attachments', 'knowledge_article_feedback',
      'knowledge_article_suggestions', 'knowledge_article_versions', 'knowledge_articles',
      'knowledge_categories', 'knowledge_tags', 'lead_activities', 'lead_contacts', 'leads',
      'location_floor_plans', 'marketing_pages', 'menu_items', 'module_tutorial_content',
      'notifications', 'pay_rate_categories', 'pdf_templates', 'po_receipt_line_items', 'po_receipts',
      'price_book_assemblies', 'price_book_items', 'profiles', 'project_attachments',
      'project_change_orders', 'project_contracts', 'project_line_items', 'project_tasks',
      'project_workers', 'projects', 'purchase_order_line_items', 'purchase_orders',
      'quote_attachments', 'quote_description_templates', 'quote_emails', 'quote_item_templates',
      'quote_line_items', 'quote_templates', 'quote_versions', 'quotes', 'recurring_invoice_line_items',
      'recurring_invoices', 'role_permissions', 'sequential_number_settings',
      'service_contract_attachments', 'service_contract_generation_history', 'service_contract_line_items',
      'service_contracts', 'service_order_attachments', 'service_order_line_items',
      'service_order_templates', 'service_orders', 'skills', 'sub_accounts_cache', 'suppliers',
      'task_comments', 'task_dependencies', 'task_markups', 'task_templates', 'tasks',
      'team_onboarding_steps', 'teams', 'tenant_settings', 'terms_conditions_templates',
      'ticket_markups', 'time_log_edit_history', 'time_logs', 'timesheets', 'user_module_tutorials',
      'user_onboarding_progress', 'user_roles', 'user_teams', 'worker_availability',
      'worker_certificates', 'worker_licenses', 'worker_schedule', 'worker_seasonal_availability',
      'worker_seasonal_availability_dates', 'worker_skills', 'worker_training', 'worker_unavailability',
      'workers', 'workflow_connections', 'workflow_execution_logs', 'workflow_executions',
      'workflow_nodes', 'workflows'
    ];

    const exportData: Record<string, any[]> = {};
    let processedCount = 0;

    // Export each table
    for (const table of tables) {
      try {
        console.log(`  📄 Exporting table: ${table} (${processedCount + 1}/${tables.length})`);
        
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .eq('tenant_id', tenantId);

        if (error) {
          console.error(`  ❌ Error exporting ${table}:`, error.message);
          exportData[table] = [];
        } else {
          exportData[table] = data || [];
          console.log(`  ✅ Exported ${data?.length || 0} rows from ${table}`);
        }
        
        processedCount++;
      } catch (err) {
        console.error(`  ❌ Exception exporting ${table}:`, err);
        exportData[table] = [];
      }
    }

    // Log the export action
    await supabaseClient.from("audit_logs").insert({
      tenant_id: tenantId,
      table_name: "data_export",
      record_id: tenantId,
      action: "export_all_data",
      user_id: user.id,
      user_name: user.email || "Unknown",
      note: `Exported all data for tenant: ${tenant.name}`
    });

    console.log(`✅ Export completed. Total tables: ${tables.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        tenantName: tenant.name,
        data: exportData,
        exportedAt: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Export failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
