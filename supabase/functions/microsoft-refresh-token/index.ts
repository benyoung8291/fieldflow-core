import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { emailAccountId } = await req.json();

    // Get the email account
    const { data: account, error: accountError } = await supabaseClient
      .from("helpdesk_email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .single();

    if (accountError || !account) {
      throw new Error("Email account not found");
    }

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");

    // Refresh the token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: account.microsoft_refresh_token,
          grant_type: "refresh_token",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token refresh failed:", errorData);
      throw new Error("Failed to refresh access token");
    }

    const tokens = await tokenResponse.json();

    // Update the account with new tokens
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    const { error: updateError } = await supabaseClient
      .from("helpdesk_email_accounts")
      .update({
        microsoft_access_token: tokens.access_token,
        microsoft_refresh_token: tokens.refresh_token || account.microsoft_refresh_token,
        microsoft_token_expires_at: expiresAt.toISOString(),
      })
      .eq("id", emailAccountId);

    if (updateError) {
      throw updateError;
    }

    console.log("Token refreshed successfully for account:", emailAccountId);

    return new Response(
      JSON.stringify({ success: true, accessToken: tokens.access_token }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-refresh-token:", error);
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