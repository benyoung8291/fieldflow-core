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

    console.log("✅ Tokens stored with session ID:", sessionId);

    // Return HTML that posts session ID to parent window (not the tokens themselves)
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Authentication Success</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container { text-align: center; padding: 2rem; }
    .checkmark { font-size: 64px; margin-bottom: 1rem; animation: scaleIn 0.5s ease-out; }
    @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>Authentication Successful!</h1>
    <p>Closing window...</p>
  </div>
  <script>
    (function() {
      console.log("OAuth popup: Starting postMessage");
      console.log("OAuth popup: window.opener exists:", !!window.opener);
      console.log("OAuth popup: window.opener.closed:", window.opener ? window.opener.closed : 'N/A');
      console.log("OAuth popup: Current origin:", window.location.origin);
      
      const sessionId = ${JSON.stringify(sessionId)};
      console.log("OAuth popup: Session ID:", sessionId);
      
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'MICROSOFT_OAUTH_SUCCESS',
            sessionId: sessionId
          }, '*');
          console.log("OAuth popup: Message posted successfully");
          setTimeout(function() { 
            console.log("OAuth popup: Closing window");
            window.close(); 
          }, 1000);
        } catch (e) {
          console.error("OAuth popup: Error posting message:", e);
          document.body.innerHTML = '<div class="container"><h1>Error</h1><p>Failed to send message. Error: ' + e.message + '</p></div>';
        }
      } else {
        console.error("OAuth popup: No opener window found");
        document.body.innerHTML = '<div class="container"><h1>Error</h1><p>No parent window found. Please close this window.</p></div>';
      }
    })();
  </script>
</body>
</html>`;
    
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
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