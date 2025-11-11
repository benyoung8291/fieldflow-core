import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/microsoft-oauth-callback`;

    if (!clientId || !tenantId) {
      throw new Error("Microsoft credentials not configured");
    }

    // Microsoft Graph API OAuth scopes
    const scopes = [
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/Mail.ReadWrite",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/User.Read",
      "offline_access"
    ].join(" ");

    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_mode", "query");

    console.log("Generated OAuth URL:", authUrl.toString());

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-oauth-authorize:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});