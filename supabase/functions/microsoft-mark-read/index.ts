import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getMicrosoftCredentials, updateMicrosoftTokens } from "../_shared/vault-credentials.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();

    if (!ticketId) {
      throw new Error("Ticket ID is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) {
      console.error("Error fetching ticket:", ticketError);
      throw new Error("Error fetching ticket");
    }

    if (!ticket) {
      console.log("Ticket not found:", ticketId);
      return new Response(
        JSON.stringify({ success: false, error: "Ticket not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get the email account if ticket has an email_account_id
    if (!ticket.email_account_id) {
      console.log("Ticket has no email account associated, skipping mark-as-read");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No email account" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: emailAccount, error: emailError } = await supabase
      .from("helpdesk_email_accounts")
      .select("id, email_address, microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at")
      .eq("id", ticket.email_account_id)
      .single();

    if (emailError || !emailAccount) {
      console.error("Email account not found:", emailError);
      throw new Error("Email account not found");
    }

    // Check if ticket has a Microsoft message ID
    if (!ticket.microsoft_message_id) {
      console.log("Ticket has no Microsoft message ID, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // emailAccount is already defined above

    // Get credentials from vault
    const credentials = await getMicrosoftCredentials(supabase, emailAccount.id);

    // Check if token needs refresh
    let accessToken = credentials.access_token;
    const tokenExpiresAt = new Date(emailAccount.microsoft_token_expires_at);
    const now = new Date();

    if (tokenExpiresAt <= now) {
      console.log("🔄 Access token expired, refreshing...");
      
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${Deno.env.get("MICROSOFT_TENANT_ID")}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
            client_secret: credentials.client_secret || Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
            grant_type: "refresh_token",
            refresh_token: credentials.refresh_token,
            scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error("Failed to refresh access token");
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update the token in vault and database
      await updateMicrosoftTokens(supabase, emailAccount.id, tokenData.access_token, tokenData.refresh_token);
      
      await supabase
        .from("helpdesk_email_accounts")
        .update({
          microsoft_token_expires_at: new Date(
            Date.now() + tokenData.expires_in * 1000
          ).toISOString(),
        })
        .eq("id", emailAccount.id);
    }

    // Mark the email as read in Microsoft
    const markReadResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${emailAccount.email_address}/messages/${ticket.microsoft_message_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isRead: true,
        }),
      }
    );

    if (!markReadResponse.ok) {
      const errorText = await markReadResponse.text();
      console.error("Failed to mark email as read:", errorText);
      throw new Error("Failed to mark email as read in Microsoft");
    }

    console.log(`✅ Marked email as read in Microsoft: ${ticket.microsoft_message_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error marking email as read:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
