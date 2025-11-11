import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

async function getTicketIdFromAccount(supabaseClient: any, emailAccountId: string, recipientEmail: string) {
  // Try to find the most recent ticket for this recipient on this email account
  const { data: ticket } = await supabaseClient
    .from("helpdesk_tickets")
    .select("id")
    .eq("email_account_id", emailAccountId)
    .or(`external_email.eq.${recipientEmail},sender_email.eq.${recipientEmail}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  return ticket?.id || null;
}

async function getValidAccessToken(supabaseClient: any, emailAccountId: string) {
  const { data: account } = await supabaseClient
    .from("helpdesk_email_accounts")
    .select("*")
    .eq("id", emailAccountId)
    .single();

  if (!account) {
    throw new Error("Email account not found");
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = new Date(account.microsoft_token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log("Token expired or expiring soon, refreshing...");
    
    // Refresh the token
    const refreshResponse = await supabaseClient.functions.invoke("microsoft-refresh-token", {
      body: { emailAccountId },
    });

    if (refreshResponse.error) {
      throw new Error("Failed to refresh token");
    }

    return refreshResponse.data.accessToken;
  }

  return account.microsoft_access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { emailAccountId, ticketId, to, cc, bcc, subject, body, replyTo, conversationId } = await req.json();

    // Get valid access token
    const accessToken = await getValidAccessToken(supabaseClient, emailAccountId);

    // Get account details
    const { data: account } = await supabaseClient
      .from("helpdesk_email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .single();

    // Convert line breaks to HTML
    const htmlBody = body.replace(/\n/g, '<br>');

    // Prepare email message
    const message = {
      message: {
        subject: subject,
        body: {
          contentType: "HTML",
          content: htmlBody,
        },
        toRecipients: Array.isArray(to) ? to.map((email: string) => ({
          emailAddress: { address: email }
        })) : [{
          emailAddress: { address: to }
        }],
        ...(cc && cc.length > 0 && {
          ccRecipients: Array.isArray(cc) ? cc.map((email: string) => ({
            emailAddress: { address: email }
          })) : [{
            emailAddress: { address: cc }
          }]
        }),
        ...(bcc && bcc.length > 0 && {
          bccRecipients: Array.isArray(bcc) ? bcc.map((email: string) => ({
            emailAddress: { address: email }
          })) : [{
            emailAddress: { address: bcc }
          }]
        }),
        ...(replyTo && {
          internetMessageId: replyTo
        }),
        ...(conversationId && {
          conversationId: conversationId
        }),
      },
      saveToSentItems: true,
    };

    // Send via Microsoft Graph API using the mailbox email address
    // This ensures the email is sent from the shared mailbox, not the authenticated user
    const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${account.email_address}/sendMail`;
    
    console.log(`Sending email from mailbox: ${account.email_address} to: ${to}`);
    
    const response = await fetch(
      sendEndpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Microsoft Graph API error:", errorData);
      throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
    }

    console.log("Email sent successfully via Microsoft Graph API");

    // Create message record in database
    const recipientEmail = Array.isArray(to) ? to[0] : to;
    const finalTicketId = ticketId || await getTicketIdFromAccount(supabaseClient, emailAccountId, recipientEmail);
    
    if (finalTicketId) {
      const { error: messageError } = await supabaseClient
        .from("helpdesk_messages")
        .insert({
          tenant_id: account.tenant_id,
          ticket_id: finalTicketId,
          message_type: "email",
          direction: "outbound",
          from_email: account.email_address,
          from_name: account.name,
          to_email: recipientEmail,
          subject: subject || "",
          body: htmlBody,
          body_html: htmlBody,
          body_text: body,
          sent_at: new Date().toISOString(),
        });

      if (messageError) {
        console.error("Failed to create message record:", messageError);
      } else {
        console.log("Message record created successfully in helpdesk_messages");
      }
      
      // Update ticket's last_message_at
      await supabaseClient
        .from("helpdesk_tickets")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", finalTicketId);
    } else {
      console.error("Could not determine ticket ID for message record");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-send-email:", error);
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