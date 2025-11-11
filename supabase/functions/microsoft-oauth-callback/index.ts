import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return new Response(
        `<html><body><h1>Authentication Failed</h1><p>${error}</p></body></html>`,
        { headers: { "Content-Type": "text/html" }, status: 400 }
      );
    }

    if (!code) {
      throw new Error("No authorization code received");
    }

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/microsoft-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code: code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      throw new Error("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();
    
    // Get user profile
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profile = await profileResponse.json();
    const email = profile.mail || profile.userPrincipalName;

    // Store tokens in session storage for the UI to retrieve
    const sessionData = {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      accountId: profile.id,
    };

    // Return HTML that closes the window and posts message to parent
    return new Response(
      `<html>
        <body>
          <script>
            window.opener.postMessage(${JSON.stringify(sessionData)}, '*');
            window.close();
          </script>
          <h1>Authentication Successful!</h1>
          <p>You can close this window.</p>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in microsoft-oauth-callback:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      `<html><body><h1>Error</h1><p>${errorMessage}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
});