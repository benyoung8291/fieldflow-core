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

    const { customerId } = await req.json();

    if (!customerId) {
      throw new Error('Missing customerId');
    }

    console.log(`Starting bulk merge for customer: ${customerId}`);

    // Find all duplicates
    const { data: duplicates, error: dupError } = await supabase.rpc('get_duplicate_locations', {
      p_customer_id: customerId
    }).select();

    if (dupError) {
      console.error('Error finding duplicates:', dupError);
      throw dupError;
    }

    console.log(`Found ${duplicates?.length || 0} duplicate pairs`);

    let merged = 0;
    let failed = 0;
    const errors: any[] = [];

    // Process each duplicate pair
    for (const dup of duplicates || []) {
      try {
        const keepId = dup.location_ids[0];
        const mergeId = dup.location_ids[1];

        console.log(`Merging ${dup.name}: keeping ${keepId}, merging ${mergeId}`);

        // Get full location data for both
        const { data: locations, error: locError } = await supabase
          .from('customer_locations')
          .select('*')
          .in('id', [keepId, mergeId]);

        if (locError || !locations || locations.length !== 2) {
          throw new Error(`Failed to fetch locations: ${locError?.message}`);
        }

        const keepLocation = locations.find(l => l.id === keepId);
        const mergeLocation = locations.find(l => l.id === mergeId);

        if (!keepLocation || !mergeLocation) {
          throw new Error('Location not found');
        }

        // Prefer non-null values from either location
        const mergedData: any = {};
        const fields = ['name', 'address', 'city', 'state', 'postcode', 'contact_name', 
                       'contact_phone', 'contact_email', 'latitude', 'longitude', 
                       'location_notes', 'customer_location_id'];

        for (const field of fields) {
          // Prefer keepLocation value, fallback to mergeLocation if keep is null
          mergedData[field] = keepLocation[field] || mergeLocation[field];
        }

        // Update the keep location with merged data
        const { error: updateError } = await supabase
          .from('customer_locations')
          .update(mergedData)
          .eq('id', keepId);

        if (updateError) throw updateError;

        // Relink service orders
        await supabase
          .from('service_orders')
          .update({ location_id: keepId })
          .eq('location_id', mergeId);

        // Relink service contract line items
        await supabase
          .from('service_contract_line_items')
          .update({ location_id: keepId })
          .eq('location_id', mergeId);

        // Mark source as merged and archived
        await supabase
          .from('customer_locations')
          .update({ 
            archived: true,
            merged_into_location_id: keepId
          })
          .eq('id', mergeId);

        merged++;
        console.log(`Successfully merged ${dup.name}`);

      } catch (error) {
        console.error(`Failed to merge ${dup.name}:`, error);
        failed++;
        errors.push({ name: dup.name, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        merged,
        failed,
        errors,
        message: `Merged ${merged} duplicate locations, ${failed} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk merge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
