import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();
    const correctPin = Deno.env.get('TV_DASHBOARD_PIN');
    
    if (!correctPin) {
      console.error('TV_DASHBOARD_PIN secret not configured');
      return new Response(
        JSON.stringify({ valid: false, error: 'PIN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const isValid = pin === correctPin;
    console.log(`PIN validation attempt: ${isValid ? 'success' : 'failed'}`);
    
    return new Response(
      JSON.stringify({ valid: isValid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validating PIN:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Invalid request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
