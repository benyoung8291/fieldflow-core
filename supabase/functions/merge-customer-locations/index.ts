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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { sourceLocationId, targetLocationId, mergedData } = await req.json();

    if (!sourceLocationId || !targetLocationId || !mergedData) {
      throw new Error('Missing required parameters');
    }

    // Update the target location with merged data
    const { error: updateError } = await supabase
      .from('customer_locations')
      .update(mergedData)
      .eq('id', targetLocationId);

    if (updateError) throw updateError;

    // Relink all related documents to target location
    // Update service orders
    await supabase
      .from('service_orders')
      .update({ location_id: targetLocationId })
      .eq('location_id', sourceLocationId);

    // Update service contract line items
    await supabase
      .from('service_contract_line_items')
      .update({ location_id: targetLocationId })
      .eq('location_id', sourceLocationId);

    // Update appointments if they reference locations
    await supabase
      .from('appointments')
      .update({ 
        location_address: mergedData.address,
        location_lat: mergedData.latitude,
        location_lng: mergedData.longitude
      })
      .eq('location_address', sourceLocationId);

    // Mark source location as merged and archived
    await supabase
      .from('customer_locations')
      .update({ 
        archived: true,
        merged_into_location_id: targetLocationId
      })
      .eq('id', sourceLocationId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Locations merged successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error merging locations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});