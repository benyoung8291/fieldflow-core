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
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'missing_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the link by token
    const { data: link, error } = await supabase
      .from('contractor_field_report_links')
      .select(`
        id,
        tenant_id,
        name,
        is_active,
        expires_at,
        tenants:tenant_id (
          id,
          name
        )
      `)
      .eq('token', token)
      .single();

    if (error || !link) {
      console.log('Link not found for token:', token);
      return new Response(
        JSON.stringify({ valid: false, reason: 'invalid_token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if link is active
    if (!link.is_active) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'link_inactive' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if link has expired
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'link_expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantData = Array.isArray(link.tenants) ? link.tenants[0] : link.tenants;

    return new Response(
      JSON.stringify({
        valid: true,
        tenantId: link.tenant_id,
        tenantName: tenantData?.name || 'Unknown',
        linkName: link.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validating contractor link:', error);
    return new Response(
      JSON.stringify({ valid: false, reason: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
