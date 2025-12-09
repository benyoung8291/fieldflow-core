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
    
    // Get the new timestamp from request body or generate current
    let newTimestamp: string;
    
    try {
      const body = await req.json();
      newTimestamp = body.buildTimestamp || new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    } catch {
      newTimestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    }
    
    console.log('Updating build timestamp to:', newTimestamp);
    
    // Update build timestamp in app_config table
    const { data, error } = await supabase
      .from('app_config')
      .upsert({ 
        key: 'build_timestamp', 
        value: newTimestamp,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'key' 
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating build timestamp:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Build timestamp updated successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        buildTimestamp: newTimestamp,
        updatedAt: data?.updated_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating build timestamp:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to update build timestamp' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
