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

    // Store tokens in session storage for the UI to retrieve
    const sessionData = {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      accountId: profile.id,
    };

    console.log("✅ Token exchange successful, sending HTML response");
    console.log("Email:", email);
    
    // Return HTML that posts message to parent and waits before closing
    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Successful</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        text-align: center;
      }
      .success {
        color: #10b981;
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
      p { color: #666; margin: 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="success">✓</div>
      <h1>Authentication Successful!</h1>
      <p>Redirecting you back to the app...</p>
    </div>
    <script>
      (function() {
        const data = ${JSON.stringify(sessionData)};
        console.log('🔔 Callback: Ready to send message', data);
        
        let attempts = 0;
        const maxAttempts = 20;
        
        const sendMessage = () => {
          if (window.opener && !window.opener.closed) {
            console.log('📤 Callback: Attempt ' + (attempts + 1) + ' - Sending to opener');
            try {
              window.opener.postMessage(data, '*');
              console.log('✅ Callback: Message posted successfully');
            } catch (err) {
              console.error('❌ Callback: Error posting message', err);
            }
            attempts++;
            
            if (attempts < maxAttempts) {
              setTimeout(sendMessage, 200);
            } else {
              console.log('⏱️ Callback: All attempts complete, closing in 3 seconds');
              setTimeout(() => {
                window.close();
              }, 3000);
            }
          } else {
            console.error('❌ Callback: No opener window found or it was closed');
            document.body.innerHTML = '<div class="container"><div class="success" style="color: #ef4444;">✗</div><h1>Error</h1><p>Parent window not found. Please close this window and try again.</p></div>';
          }
        };
        
        // Start immediately
        setTimeout(sendMessage, 100);
      })();
    </script>
  </body>
</html>`;

    console.log("📤 Sending HTML response with postMessage script");
    
    return new Response(htmlContent, {
      headers: { 
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
      },
      status: 200
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