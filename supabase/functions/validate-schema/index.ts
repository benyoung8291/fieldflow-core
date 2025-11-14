import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface ForeignKey {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface IndexInfo {
  table_name: string;
  index_name: string;
  column_name: string;
  is_unique: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all tables in public schema
    const { data: tables, error: tablesError } = await supabase.rpc("exec_sql", {
      sql: `
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name NOT LIKE 'pg_%'
        ORDER BY table_name;
      `
    });

    if (tablesError) throw tablesError;

    // Get all columns
    const { data: columns, error: columnsError } = await supabase.rpc("exec_sql", {
      sql: `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name NOT LIKE 'pg_%'
        ORDER BY table_name, ordinal_position;
      `
    });

    if (columnsError) throw columnsError;

    // Get all foreign keys
    const { data: foreignKeys, error: fkError } = await supabase.rpc("exec_sql", {
      sql: `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public';
      `
    });

    if (fkError) throw fkError;

    // Get all indexes
    const { data: indexes, error: indexError } = await supabase.rpc("exec_sql", {
      sql: `
        SELECT
          t.relname AS table_name,
          i.relname AS index_name,
          a.attname AS column_name,
          ix.indisunique AS is_unique
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
        AND t.relkind = 'r'
        ORDER BY t.relname, i.relname;
      `
    });

    if (indexError) throw indexError;

    // Analyze schema and generate recommendations
    const recommendations: string[] = [];
    const relationships: Array<{from: string, to: string, type: string}> = [];

    // Check for missing foreign keys based on naming conventions
    const tableList = (tables as any[]).map(t => t.table_name);
    const fkList = (foreignKeys as any[]);
    const columnList = (columns as any[]) as TableInfo[];

    // Group columns by table
    const columnsByTable = columnList.reduce((acc, col) => {
      if (!acc[col.table_name]) acc[col.table_name] = [];
      acc[col.table_name].push(col);
      return acc;
    }, {} as Record<string, TableInfo[]>);

    // Check each table's columns for potential missing foreign keys
    for (const table of tableList) {
      const tableCols = columnsByTable[table] || [];
      
      for (const col of tableCols) {
        // Check for _id columns that might need foreign keys
        if (col.column_name.endsWith('_id') && col.column_name !== 'id') {
          const potentialTable = col.column_name.replace('_id', 's');
          const altPotentialTable = col.column_name.replace('_id', '');
          
          // Check if foreign key exists
          const hasFk = fkList.some((fk: any) => 
            fk.table_name === table && fk.column_name === col.column_name
          );

          if (!hasFk) {
            if (tableList.includes(potentialTable)) {
              recommendations.push(
                `⚠️ Table '${table}.${col.column_name}' might need a foreign key to '${potentialTable}.id'`
              );
            } else if (tableList.includes(altPotentialTable)) {
              recommendations.push(
                `⚠️ Table '${table}.${col.column_name}' might need a foreign key to '${altPotentialTable}.id'`
              );
            }
          }
        }
      }
    }

    // Add existing relationships for visualization
    for (const fk of fkList) {
      relationships.push({
        from: fk.table_name,
        to: fk.foreign_table_name,
        type: 'foreign_key'
      });
    }

    // Check for missing indexes on foreign key columns
    const indexList = (indexes as any[]) as IndexInfo[];
    for (const fk of fkList) {
      const hasIndex = indexList.some(idx => 
        idx.table_name === fk.table_name && 
        idx.column_name === fk.column_name
      );

      if (!hasIndex) {
        recommendations.push(
          `⚡ Consider adding an index on '${fk.table_name}.${fk.column_name}' for better query performance`
        );
      }
    }

    // Check for tables without primary keys
    for (const table of tableList) {
      const tableCols = columnsByTable[table] || [];
      const hasPrimaryKey = tableCols.some(col => 
        col.column_default?.includes('gen_random_uuid()') || 
        col.column_name === 'id'
      );

      if (!hasPrimaryKey) {
        recommendations.push(
          `🔑 Table '${table}' might be missing a primary key`
        );
      }
    }

    // Check for nullable foreign keys (potential data integrity issues)
    for (const fk of fkList) {
      const col = columnList.find(c => 
        c.table_name === fk.table_name && c.column_name === fk.column_name
      );

      if (col && col.is_nullable === 'YES') {
        recommendations.push(
          `💡 Foreign key '${fk.table_name}.${fk.column_name}' is nullable - consider if this is intentional`
        );
      }
    }

    return new Response(
      JSON.stringify({
        tables: tableList,
        columns: columnsByTable,
        foreignKeys: fkList,
        indexes: indexList,
        relationships,
        recommendations,
        stats: {
          totalTables: tableList.length,
          totalColumns: columnList.length,
          totalForeignKeys: fkList.length,
          totalIndexes: [...new Set(indexList.map(i => i.index_name))].length,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});