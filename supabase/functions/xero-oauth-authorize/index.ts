import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, integrationId } = await req.json();

    if (!clientId || !integrationId) {
      throw new Error("Missing required parameters");
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/xero-oauth-callback`;
    
    // Xero OAuth scopes needed for the integration
    const scopes = [
      'offline_access',
      'accounting.transactions',
      'accounting.transactions.read',
      'accounting.settings',
      'accounting.settings.read',
      'payroll.timesheets',
      'payroll.employees',
      'payroll.employees.read'
    ].join(' ');

    // Build authorization URL
    const authUrl = new URL('https://login.xero.com/identity/connect/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', integrationId); // Use integration ID as state

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error generating Xero auth URL:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
