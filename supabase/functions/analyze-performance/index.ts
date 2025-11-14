import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TableSize {
  table_name: string;
  total_size: string;
  table_size: string;
  indexes_size: string;
  row_count: number;
}

interface SlowQuery {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  rows: number;
}

interface IndexUsage {
  table_name: string;
  index_name: string;
  index_scans: number;
  rows_read: number;
  rows_fetched: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const recommendations: string[] = [];
    const tableSizes: TableSize[] = [];
    const slowQueries: SlowQuery[] = [];
    const indexUsage: IndexUsage[] = [];

    // Get table sizes and row counts
    try {
      const { data: sizes, error: sizesError } = await supabase.rpc('get_table_sizes' as any);
      
      if (!sizesError && sizes && Array.isArray(sizes)) {
        tableSizes.push(...sizes);

        // Analyze table sizes for recommendations
        for (const table of sizes) {
          const sizeInMB = parseFloat(table.table_size || '0') / (1024 * 1024);
          const rowCount = typeof table.row_count === 'number' ? table.row_count : parseInt(table.row_count || '0');

          // Suggest partitioning for large tables
          if (sizeInMB > 1000) {
            recommendations.push(
              `📊 Table '${table.table_name}' is ${Math.round(sizeInMB)}MB with ${rowCount.toLocaleString()} rows. Consider partitioning by date or key column for better performance.`
            );
          }

          // Suggest archiving old data
          if (rowCount > 100000) {
            recommendations.push(
              `📦 Table '${table.table_name}' has ${rowCount.toLocaleString()} rows. Consider archiving historical data older than 2 years to improve query performance.`
            );
          }

          // Check if indexes are too large relative to table
          const indexSizeInMB = parseFloat(table.indexes_size || '0') / (1024 * 1024);
          if (indexSizeInMB > sizeInMB * 0.5 && sizeInMB > 100) {
            recommendations.push(
              `⚡ Table '${table.table_name}' has indexes (${Math.round(indexSizeInMB)}MB) that are ${Math.round((indexSizeInMB / sizeInMB) * 100)}% of table size. Review if all indexes are necessary.`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error fetching table sizes:", error);
    }

    // Get slow queries from pg_stat_statements (if extension is enabled)
    try {
      const { data: queries, error: queriesError } = await supabase.rpc('get_slow_queries' as any);
      
      if (!queriesError && queries && Array.isArray(queries)) {
        slowQueries.push(...queries.slice(0, 10)); // Top 10 slowest

        for (const query of queries.slice(0, 5)) {
          if (query.mean_time > 1000) {
            recommendations.push(
              `🐢 Slow query detected (avg ${Math.round(query.mean_time)}ms, ${query.calls} calls). Consider adding indexes or optimizing the query.`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error fetching slow queries:", error);
    }

    // Get index usage statistics
    try {
      const { data: indexes, error: indexesError } = await supabase.rpc('get_index_usage' as any);
      
      if (!indexesError && indexes && Array.isArray(indexes)) {
        indexUsage.push(...indexes);

        // Find unused indexes
        const unusedIndexes = indexes.filter(idx => idx.index_scans === 0);
        for (const idx of unusedIndexes.slice(0, 5)) {
          recommendations.push(
            `🗑️ Index '${idx.index_name}' on table '${idx.table_name}' is never used. Consider dropping it to save space and improve write performance.`
          );
        }

        // Find indexes with low usage
        const lowUsageIndexes = indexes.filter(idx => 
          idx.index_scans > 0 && idx.index_scans < 10 && idx.rows_read > 10000
        );
        for (const idx of lowUsageIndexes.slice(0, 3)) {
          recommendations.push(
            `⚠️ Index '${idx.index_name}' on table '${idx.table_name}' has very low usage (${idx.index_scans} scans). Evaluate if it's necessary.`
          );
        }
      }
    } catch (error) {
      console.error("Error fetching index usage:", error);
    }

    // Analyze for common optimization patterns
    const largestTables = tableSizes
      .sort((a, b) => parseInt(b.table_size) - parseInt(a.table_size))
      .slice(0, 5);

    for (const table of largestTables) {
      // Check for tables that might benefit from VACUUM
      const rowCount = typeof table.row_count === 'number' ? table.row_count : parseInt(table.row_count || '0');
      if (rowCount > 10000) {
        recommendations.push(
          `🧹 Table '${table.table_name}' is one of the largest tables. Regular VACUUM ANALYZE can help maintain query performance.`
        );
      }
    }

    // Check for tables without updated_at or created_at for archiving strategy
    try {
      const { data: tables } = await supabase
        .from("information_schema.columns" as any)
        .select("table_name")
        .eq("table_schema", "public")
        .in("column_name", ["created_at", "updated_at"]);

      const tablesWithTimestamps = new Set(tables?.map(t => t.table_name) || []);
      const largeTablesWithoutTimestamps = tableSizes
        .filter(t => {
          const rowCount = typeof t.row_count === 'number' ? t.row_count : parseInt(t.row_count || '0');
          return !tablesWithTimestamps.has(t.table_name) && rowCount > 10000;
        })
        .slice(0, 3);

      for (const table of largeTablesWithoutTimestamps) {
        const rowCount = typeof table.row_count === 'number' ? table.row_count : parseInt(table.row_count || '0');
        recommendations.push(
          `📅 Table '${table.table_name}' has ${rowCount.toLocaleString()} rows but no timestamp columns. Add created_at/updated_at to enable time-based archiving.`
        );
      }
    } catch (error) {
      console.error("Error checking timestamp columns:", error);
    }

    // Calculate total database size
    const totalDbSize = tableSizes.reduce((sum, t) => sum + parseFloat(t.total_size || '0'), 0);
    const totalDbSizeMB = totalDbSize / (1024 * 1024);

    // General recommendations based on database size
    if (totalDbSizeMB > 5000) {
      recommendations.push(
        `💾 Database size is ${Math.round(totalDbSizeMB)}MB. Consider implementing a data lifecycle policy with archiving and purging strategies.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ No performance issues detected. Your database is running well!");
    }

    return new Response(
      JSON.stringify({
        tableSizes: tableSizes.slice(0, 20), // Top 20 largest tables
        slowQueries: slowQueries.slice(0, 10), // Top 10 slowest queries
        indexUsage: indexUsage.slice(0, 20), // Top 20 indexes
        recommendations,
        stats: {
          totalTables: tableSizes.length,
          totalSizeMB: Math.round(totalDbSizeMB),
          slowQueryCount: slowQueries.filter(q => q.mean_time > 100).length,
          unusedIndexCount: indexUsage.filter(i => i.index_scans === 0).length,
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
        recommendations: ["⚠️ Unable to analyze performance. Some PostgreSQL extensions may not be enabled."],
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