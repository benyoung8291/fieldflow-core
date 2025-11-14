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

    // Check which tables exist and get their columns by querying them
    const existingTables: string[] = [];
    
    for (const tableName of knownTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          existingTables.push(tableName);
          
          // Extract column names from the data structure
          if (data && data.length > 0) {
            const columns = Object.keys(data[0]).map(columnName => ({
              column_name: columnName,
              data_type: typeof data[0][columnName] === 'number' ? 'numeric' : 
                         typeof data[0][columnName] === 'boolean' ? 'boolean' :
                         data[0][columnName] === null ? 'unknown' : 'text',
              is_nullable: 'YES',
            }));
            columnsByTable[tableName] = columns;
          } else {
            // Table exists but is empty, try to infer from a failed select
            columnsByTable[tableName] = [];
          }
        }
      } catch (e) {
        // Table doesn't exist or can't be accessed
      }
    }

    console.log(`Found ${existingTables.length} accessible tables`);

    // Build known relationships - including logical settings/lookup table connections
    const knownRelationships = [
      // Core entity relationships
      { from: 'appointments', to: 'service_orders', type: 'foreign_key' },
      { from: 'appointments', to: 'profiles', type: 'foreign_key' },
      { from: 'appointment_workers', to: 'appointments', type: 'foreign_key' },
      { from: 'appointment_workers', to: 'profiles', type: 'foreign_key' },
      { from: 'appointment_attachments', to: 'appointments', type: 'foreign_key' },
      { from: 'appointment_templates', to: 'service_orders', type: 'logical' },
      
      // Customer relationships
      { from: 'customer_locations', to: 'customers', type: 'foreign_key' },
      { from: 'customer_contacts', to: 'customers', type: 'foreign_key' },
      { from: 'invoices', to: 'customers', type: 'foreign_key' },
      { from: 'quotes', to: 'customers', type: 'foreign_key' },
      { from: 'projects', to: 'customers', type: 'foreign_key' },
      { from: 'service_orders', to: 'customers', type: 'foreign_key' },
      { from: 'service_contracts', to: 'customers', type: 'foreign_key' },
      
      // Invoice/Quote line items
      { from: 'invoice_line_items', to: 'invoices', type: 'foreign_key' },
      { from: 'quote_line_items', to: 'quotes', type: 'foreign_key' },
      
      // Project relationships
      { from: 'project_change_orders', to: 'projects', type: 'foreign_key' },
      { from: 'change_order_line_items', to: 'project_change_orders', type: 'foreign_key' },
      { from: 'tasks', to: 'projects', type: 'foreign_key' },
      
      // Expense relationships
      { from: 'expenses', to: 'profiles', type: 'foreign_key' },
      { from: 'expenses', to: 'projects', type: 'foreign_key' },
      { from: 'expenses', to: 'expense_categories', type: 'logical' },
      { from: 'expense_attachments', to: 'expenses', type: 'foreign_key' },
      { from: 'expense_policy_rules', to: 'expense_categories', type: 'logical' },
      
      // Time tracking
      { from: 'time_logs', to: 'appointments', type: 'foreign_key' },
      { from: 'time_logs', to: 'profiles', type: 'foreign_key' },
      
      // Settings tables relationships
      { from: 'brand_colors', to: 'profiles', type: 'settings' },
      { from: 'general_settings', to: 'profiles', type: 'settings' },
      { from: 'crm_status_settings', to: 'customers', type: 'settings' },
      { from: 'crm_pipelines', to: 'quotes', type: 'settings' },
      
      // Credit card relationships
      { from: 'credit_card_transactions', to: 'company_credit_cards', type: 'foreign_key' },
      { from: 'credit_card_transactions', to: 'expenses', type: 'logical' },
      { from: 'company_credit_cards', to: 'expenses', type: 'settings' },
      
      // Help desk relationships
      { from: 'helpdesk_tickets', to: 'customers', type: 'foreign_key' },
      { from: 'helpdesk_tickets', to: 'contacts', type: 'foreign_key' },
      { from: 'helpdesk_tickets', to: 'helpdesk_pipelines', type: 'logical' },
      { from: 'helpdesk_messages', to: 'helpdesk_tickets', type: 'foreign_key' },
      { from: 'helpdesk_linked_documents', to: 'helpdesk_tickets', type: 'foreign_key' },
      { from: 'helpdesk_email_accounts', to: 'helpdesk_tickets', type: 'settings' },
      
      // Customer messages
      { from: 'customer_message_templates', to: 'customers', type: 'settings' },
      
      // Accounting integration
      { from: 'accounting_integrations', to: 'expenses', type: 'settings' },
      { from: 'accounting_integrations', to: 'invoices', type: 'settings' },
      
      // Audit trail
      { from: 'audit_logs', to: 'profiles', type: 'system' },
    ];

    relationships.push(...knownRelationships.filter(rel => 
      existingTables.includes(rel.from) && existingTables.includes(rel.to)
    ));

    console.log(`Found ${relationships.length} relationships between existing tables`);

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

    const totalColumns = Object.values(columnsByTable).reduce((sum, cols) => sum + cols.length, 0);

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
          totalColumns,
          totalForeignKeys: relationships.length,
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