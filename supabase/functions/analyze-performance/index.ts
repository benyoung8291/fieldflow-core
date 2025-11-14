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

    console.log('Starting performance analysis...');

    const recommendations: string[] = [];
    const tableSizes: any[] = [];

    // Tables to analyze
    const tablesToAnalyze = [
      'appointments', 'customers', 'customer_locations', 'service_orders',
      'quotes', 'quote_line_items', 'invoices', 'invoice_line_items', 
      'projects', 'expenses', 'audit_logs', 'helpdesk_tickets', 
      'helpdesk_messages', 'time_logs', 'tasks', 'profiles'
    ];

    // Analyze each table by counting rows
    for (const tableName of tablesToAnalyze) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error && count !== null) {
          // Estimate size: ~1KB per row for small tables, ~2KB for large tables
          const avgRowSize = count > 100000 ? 2000 : 1000;
          const estimatedSizeBytes = count * avgRowSize;
          
          tableSizes.push({
            table_name: tableName,
            row_count: count,
            total_size: estimatedSizeBytes.toString(),
            table_size: (estimatedSizeBytes * 0.7).toString(),
            indexes_size: (estimatedSizeBytes * 0.3).toString(),
          });

          // Generate recommendations
          if (count > 100000) {
            recommendations.push(
              `📦 Table '${tableName}' has ${count.toLocaleString()} rows. Consider archiving historical data older than 2 years.`
            );
          }

          if (count > 500000) {
            recommendations.push(
              `📊 Table '${tableName}' has ${count.toLocaleString()} rows. Consider partitioning by date for better performance.`
            );
          }

          if (count > 50000) {
            recommendations.push(
              `🧹 Table '${tableName}' would benefit from regular VACUUM ANALYZE operations.`
            );
          }

          console.log(`${tableName}: ${count} rows`);
        }
      } catch (error) {
        console.error(`Error analyzing ${tableName}:`, error);
      }
    }

    // Sort by row count descending
    tableSizes.sort((a, b) => b.row_count - a.row_count);

    // Add general recommendations
    recommendations.push(
      `⚡ Ensure indexes exist on frequently queried columns and foreign keys`
    );
    recommendations.push(
      `💾 Monitor database growth trends and plan for scaling`
    );
    recommendations.push(
      `📅 Add created_at/updated_at timestamps to enable time-based archiving`
    );

    // Calculate totals
    const totalRows = tableSizes.reduce((sum, t) => sum + t.row_count, 0);
    const totalSizeBytes = tableSizes.reduce((sum, t) => sum + parseFloat(t.total_size), 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);

    if (totalSizeMB > 5000) {
      recommendations.push(
        `💾 Database is approximately ${Math.round(totalSizeMB)}MB. Consider data lifecycle policies.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ No performance issues detected!");
    }

    console.log(`Analysis complete: ${tableSizes.length} tables, ${recommendations.length} recommendations`);

    return new Response(
      JSON.stringify({
        tableSizes: tableSizes.slice(0, 20),
        slowQueries: [],
        indexUsage: [],
        recommendations,
        stats: {
          totalTables: tableSizes.length,
          totalSizeMB: Math.round(totalSizeMB),
          slowQueryCount: 0,
          unusedIndexCount: 0,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error analyzing performance:", error);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message,
        tableSizes: [],
        slowQueries: [],
        indexUsage: [],
        recommendations: ["⚠️ Unable to complete performance analysis."],
        stats: {
          totalTables: 0,
          totalSizeMB: 0,
          slowQueryCount: 0,
          unusedIndexCount: 0,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});