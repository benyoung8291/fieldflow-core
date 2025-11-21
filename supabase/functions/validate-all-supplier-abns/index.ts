import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Starting batch ABN validation for all suppliers');

    // Fetch all suppliers with ABN that need validation
    const { data: suppliers, error: fetchError } = await supabaseClient
      .from('suppliers')
      .select('id, abn, name, legal_company_name, trading_name')
      .not('abn', 'is', null)
      .order('name');

    if (fetchError) {
      console.error('Error fetching suppliers:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${suppliers?.length || 0} suppliers with ABN`);

    const results = {
      total: suppliers?.length || 0,
      validated: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Process each supplier
    for (const supplier of suppliers || []) {
      if (!supplier.abn || supplier.abn.trim() === '') {
        results.skipped++;
        continue;
      }

      try {
        console.log(`Validating ABN ${supplier.abn} for supplier: ${supplier.name}`);

        // Call the validate-abn function
        const { data: validationResult, error: validationError } = await supabaseClient.functions.invoke(
          'validate-abn',
          {
            body: { abn: supplier.abn }
          }
        );

        if (validationError) {
          console.error(`Validation error for ${supplier.name}:`, validationError);
          results.failed++;
          results.details.push({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            abn: supplier.abn,
            status: 'error',
            error: validationError.message
          });
          continue;
        }

        // Update supplier with validation results
        const updateData: any = {
          abn_validation_status: validationResult.valid ? 'valid' : 'invalid',
          abn_validated_at: new Date().toISOString()
        };

        // Update legal_company_name and trading_name if validation was successful
        if (validationResult.valid && validationResult.business_details) {
          if (validationResult.business_details.legal_name) {
            updateData.legal_company_name = validationResult.business_details.legal_name;
          }
          if (validationResult.business_details.trading_names && 
              validationResult.business_details.trading_names.length > 0) {
            updateData.trading_name = validationResult.business_details.trading_names[0];
          }
          if (validationResult.business_details.gst_registered !== undefined) {
            updateData.gst_registered = validationResult.business_details.gst_registered;
          }
        }

        if (!validationResult.valid && validationResult.message) {
          updateData.abn_validation_error = validationResult.message;
        }

        const { error: updateError } = await supabaseClient
          .from('suppliers')
          .update(updateData)
          .eq('id', supplier.id);

        if (updateError) {
          console.error(`Error updating supplier ${supplier.name}:`, updateError);
          results.failed++;
          results.details.push({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            abn: supplier.abn,
            status: 'update_error',
            error: updateError.message
          });
        } else {
          results.validated++;
          results.details.push({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            abn: supplier.abn,
            status: validationResult.valid ? 'valid' : 'invalid',
            legal_name: validationResult.business_details?.legal_name,
            gst_registered: validationResult.business_details?.gst_registered
          });
          console.log(`✓ Successfully validated ${supplier.name}: ${validationResult.valid ? 'VALID' : 'INVALID'}`);
        }

      } catch (error) {
        console.error(`Error processing supplier ${supplier.name}:`, error);
        results.failed++;
        results.details.push({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          abn: supplier.abn,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log('Batch validation complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in validate-all-supplier-abns:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
