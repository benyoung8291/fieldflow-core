import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // integration ID
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Xero Connection Failed</title></head>
        <body style="font-family: system-ui; padding: 2rem; text-align: center;">
          <h1>❌ Connection Failed</h1>
          <p>Failed to connect to Xero: ${error}</p>
          <p><a href="/settings">Return to Settings</a></p>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code || !state) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Invalid Request</title></head>
        <body style="font-family: system-ui; padding: 2rem; text-align: center;">
          <h1>❌ Invalid Request</h1>
          <p>Missing authorization code or state parameter.</p>
          <p><a href="/settings">Return to Settings</a></p>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the integration record to retrieve client credentials
    const { data: integration, error: fetchError } = await supabase
      .from('accounting_integrations')
      .select('*')
      .eq('id', state)
      .single();

    if (fetchError || !integration) {
      throw new Error('Integration not found');
    }

    const clientId = integration.xero_client_id;
    const clientSecret = integration.xero_client_secret;

    if (!clientId || !clientSecret) {
      throw new Error('Client credentials not configured');
    }

    // Exchange authorization code for tokens
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/xero-oauth-callback`;
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();

    // Don't set tenant ID yet - let user select from available organizations

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Update integration with tokens (tenant ID will be selected by user)
    const { error: updateError } = await supabase
      .from('accounting_integrations')
      .update({
        xero_access_token: tokens.access_token,
        xero_refresh_token: tokens.refresh_token,
        xero_token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', state);

    if (updateError) {
      throw updateError;
    }

    // Success page
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Xero Connected</title>
          <script>
            // Close window after delay or redirect
            setTimeout(() => {
              window.opener?.postMessage({ type: 'xero-oauth-success' }, '*');
              window.close();
              // If window doesn't close, redirect
              setTimeout(() => {
                window.location.href = '/settings';
              }, 1000);
            }, 2000);
          </script>
        </head>
        <body style="font-family: system-ui; padding: 2rem; text-align: center;">
          <h1>✅ Successfully Connected to Xero!</h1>
          <p>Please select your organization...</p>
          <p>This window will close automatically...</p>
          <p><a href="/settings">Return to Settings</a></p>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Connection Error</title></head>
        <body style="font-family: system-ui; padding: 2rem; text-align: center;">
          <h1>❌ Connection Error</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
          <p><a href="/settings">Return to Settings</a></p>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
