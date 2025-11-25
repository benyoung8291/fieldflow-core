import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { startDate: bodyStartDate, endDate: bodyEndDate, manualGeneration = false, automated = false } = body;

    console.log("🚀 Starting service order generation...");
    console.log(`📋 Manual generation: ${manualGeneration}, Automated: ${automated}`);

    // Handle automated cron job - process all tenants
    if (automated) {
      console.log("🔄 Processing automated generation for all tenants...");
      
      // Get all active tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name');
      
      if (tenantsError) {
        console.error("❌ Error fetching tenants:", tenantsError);
        throw tenantsError;
      }

      const results = [];
      
      for (const tenant of tenants || []) {
        try {
          // Get lookahead days from settings
          const { data: settings } = await supabase
            .from('general_settings')
            .select('service_order_generation_lookahead_days')
            .eq('tenant_id', tenant.id)
            .single();

          const lookaheadDays = settings?.service_order_generation_lookahead_days || 30;
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startDate = today.toISOString().split("T")[0];
          
          const futureDate = new Date(today);
          futureDate.setDate(futureDate.getDate() + lookaheadDays);
          const endDate = futureDate.toISOString().split("T")[0];
          
          console.log(`📅 Processing tenant ${tenant.name} (${tenant.id}): ${startDate} to ${endDate} (${lookaheadDays} days)`);

          // Get a system user for this tenant (first admin)
          const { data: adminUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'tenant_admin')
            .eq('tenant_id', tenant.id)
            .limit(1)
            .single();

          const userId = adminUser?.user_id || '00000000-0000-0000-0000-000000000000';

          const { data, error } = await supabase.rpc('generate_service_orders_from_contracts', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_tenant_id: tenant.id,
            p_user_id: userId
          });

          if (error) {
            console.error(`❌ Error for tenant ${tenant.name}:`, error);
            results.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              success: false,
              error: error.message
            });
          } else {
            console.log(`✅ Tenant ${tenant.name}: ${data.summary.orders_created} orders created`);
            results.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              success: true,
              ...data
            });
          }
        } catch (error: any) {
          console.error(`❌ Exception for tenant ${tenant.name}:`, error);
          results.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            success: false,
            error: error.message
          });
        }
      }

      return new Response(
        JSON.stringify({
          automated: true,
          results
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual generation - requires authentication and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'User has no tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has tenant_admin role
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'tenant_admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Authenticated admin user: ${user.id}`);

    // Determine date range for manual generation
    let startDate: string;
    let endDate: string;

    if (manualGeneration && bodyStartDate && bodyEndDate) {
      startDate = bodyStartDate;
      endDate = bodyEndDate;
      console.log(`📅 Manual generation for date range: ${startDate} to ${endDate}`);
    } else {
      // Default: use today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = endDate = today.toISOString().split("T")[0];
      console.log(`📅 Single-day generation for date: ${startDate}`);
    }

    // Call the database function to generate service orders
    console.log("📞 Calling database function...");
    
    const { data, error } = await supabase.rpc('generate_service_orders_from_contracts', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_tenant_id: profile.tenant_id,
      p_user_id: user.id
    });

    if (error) {
      console.error("❌ Error calling database function:", error);
      throw error;
    }

    console.log("✅ Generation complete");
    console.log(`📊 Results: ${data.summary.orders_created} orders created, ${data.summary.total_line_items} items processed`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error in service order generation:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to calculate next generation date based on frequency
function calculateNextGenerationDate(currentDate: string, frequency: string): string | null {
  const date = new Date(currentDate);

  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "fortnightly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    case "one_time":
      // For one-time items, set to null so they don't generate again
      return null;
    default:
      console.warn(`Unknown frequency: ${frequency}`);
      return null;
  }

  return date.toISOString().split("T")[0];
}
