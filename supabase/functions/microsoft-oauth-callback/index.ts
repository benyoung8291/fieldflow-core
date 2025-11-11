import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  console.log("🔔 CALLBACK FUNCTION HIT!", req.url);
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  
  try {
    const url = new URL(req.url);
    console.log("Full URL:", url.toString());
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    console.log("Code:", code ? "present" : "missing");
    console.log("Error:", error);

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

    console.log("✅ Token exchange successful, storing in database");
    console.log("Email:", email);

    // Generate unique session ID
    const sessionId = crypto.randomUUID();

    // Store tokens in database temporarily
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertError } = await supabase
      .from("oauth_temp_tokens")
      .insert({
        session_id: sessionId,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        account_id: profile.id,
      });

    if (insertError) {
      console.error("Failed to store tokens:", insertError);
      throw new Error("Failed to store authentication tokens");
    }

    console.log("✅ Tokens stored, redirecting with session ID:", sessionId);

    // Get the referer to determine the correct app URL
    const referer = req.headers.get("referer") || "";
    console.log("Referer:", referer);
    
    // Extract the origin from the referer
    let appUrl = "https://lovable.dev"; // fallback
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        appUrl = refererUrl.origin;
        console.log("Using app URL from referer:", appUrl);
      } catch (e) {
        console.warn("Could not parse referer, using fallback");
      }
    }
    
    const redirectUrl = `${appUrl}/settings?tab=integrations&microsoft_oauth_session=${sessionId}`;
    console.log("Redirecting to:", redirectUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
      },
    });
  } catch (error) {
    console.error("Error in microsoft-oauth-callback:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      `<html><body><h1>Error</h1><p>${errorMessage}</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
});