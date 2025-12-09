import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Read build timestamp from app_config table
    const { data, error } = await supabase
      .from('app_config')
      .select('value, updated_at')
      .eq('key', 'build_timestamp')
      .single();
    
    if (error) {
      console.error('Error fetching build timestamp:', error);
      return new Response(
        JSON.stringify({ 
          buildTimestamp: 'unknown',
          error: 'Failed to fetch version'
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        buildTimestamp: data?.value || 'unknown',
        updatedAt: data?.updated_at || null
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        } 
      }
    );
  } catch (error) {
    console.error('Error getting app version:', error);
    return new Response(
      JSON.stringify({ buildTimestamp: 'unknown', error: 'Failed to get version' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
