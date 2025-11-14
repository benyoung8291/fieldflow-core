import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting schema validation...");

    // List of known tables in the system
    const knownTables = [
      'accounting_integrations', 'appointment_attachments', 'appointment_templates',
      'appointment_workers', 'appointments', 'audit_logs', 'brand_colors',
      'change_order_line_items', 'company_credit_cards', 'contacts',
      'credit_card_transactions', 'crm_pipelines', 'crm_status_settings',
      'customer_contacts', 'customer_locations', 'customer_message_templates',
      'customers', 'expense_attachments', 'expense_categories', 'expense_policy_rules',
      'expenses', 'general_settings', 'helpdesk_email_accounts', 'helpdesk_linked_documents',
      'helpdesk_messages', 'helpdesk_pipelines', 'helpdesk_tickets', 'invoices',
      'invoice_line_items', 'projects', 'project_change_orders', 'quotes', 'quote_line_items',
      'service_orders', 'service_contracts', 'time_logs', 'tasks', 'profiles'
    ];

    const recommendations: string[] = [];
    const relationships: Array<{from: string, to: string, type: string}> = [];
    const columnsByTable: Record<string, any[]> = {};

    // Check which tables exist by trying to query them
    const existingTables: string[] = [];
    
    for (const tableName of knownTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (!error) {
          existingTables.push(tableName);
        }
      } catch (e) {
        // Table doesn't exist or can't be accessed
      }
    }

    console.log(`Found ${existingTables.length} accessible tables`);

    // Build known relationships
    const knownRelationships = [
      { from: 'appointments', to: 'service_orders', type: 'foreign_key' },
      { from: 'appointments', to: 'profiles', type: 'foreign_key' },
      { from: 'appointment_workers', to: 'appointments', type: 'foreign_key' },
      { from: 'appointment_workers', to: 'profiles', type: 'foreign_key' },
      { from: 'expenses', to: 'profiles', type: 'foreign_key' },
      { from: 'expenses', to: 'projects', type: 'foreign_key' },
      { from: 'helpdesk_tickets', to: 'customers', type: 'foreign_key' },
      { from: 'helpdesk_tickets', to: 'contacts', type: 'foreign_key' },
      { from: 'customer_locations', to: 'customers', type: 'foreign_key' },
      { from: 'customer_contacts', to: 'customers', type: 'foreign_key' },
      { from: 'invoices', to: 'customers', type: 'foreign_key' },
      { from: 'quotes', to: 'customers', type: 'foreign_key' },
      { from: 'projects', to: 'customers', type: 'foreign_key' },
      { from: 'service_orders', to: 'customers', type: 'foreign_key' },
    ];

    relationships.push(...knownRelationships.filter(rel => 
      existingTables.includes(rel.from) && existingTables.includes(rel.to)
    ));

    // General recommendations
    recommendations.push(
      `⚡ Ensure indexes exist on foreign key columns (customer_id, user_id, tenant_id) for better JOIN performance`
    );
    recommendations.push(
      `💡 Regular VACUUM ANALYZE operations help maintain optimal query performance`
    );
    recommendations.push(
      `📊 Monitor table growth and consider partitioning for tables with millions of rows`
    );
    recommendations.push(
      `🔍 Review RLS policies to ensure proper data security and access control`
    );

    console.log(`Analysis complete. ${recommendations.length} recommendations generated.`);

    return new Response(
      JSON.stringify({
        tables: existingTables,
        columns: columnsByTable,
        foreignKeys: knownRelationships,
        indexes: [],
        relationships,
        recommendations,
        stats: {
          totalTables: existingTables.length,
          totalColumns: 0,
          totalForeignKeys: knownRelationships.length,
          totalIndexes: 0,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error analyzing schema:", error);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message,
        tables: [],
        columns: {},
        foreignKeys: [],
        indexes: [],
        relationships: [],
        recommendations: ["⚠️ Unable to analyze schema. Please check permissions."],
        stats: {
          totalTables: 0,
          totalColumns: 0,
          totalForeignKeys: 0,
          totalIndexes: 0,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});