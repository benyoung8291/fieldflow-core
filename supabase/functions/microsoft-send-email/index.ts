import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, graphAPIRequest } from "../_shared/microsoft-graph.ts";

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

// Removed - now using shared microsoft-graph.ts module

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized: Invalid or missing authentication");
    }

    const { emailAccountId, ticketId, to, cc, bcc, subject, body, replyTo, conversationId } = await req.json();

    // Validate required fields
    if (!emailAccountId || !to || !subject) {
      throw new Error("Missing required fields: emailAccountId, to, subject");
    }

    // Use service role client for database operations
    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get account details and verify user has access
    const { data: account, error: accountError } = await supabaseServiceClient
      .from("helpdesk_email_accounts")
      .select("*, tenant_id")
      .eq("id", emailAccountId)
      .single();

    if (accountError || !account) {
      throw new Error("Email account not found");
    }

    // Verify user belongs to the same tenant as the email account
    const { data: profile } = await supabaseServiceClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.tenant_id !== account.tenant_id) {
      throw new Error("Unauthorized: User does not have access to this email account");
    }

    // Convert line breaks to HTML and sanitize
    const htmlBody = body.replace(/\n/g, '<br>');

    // Send email using shared Graph API module
    const config = {
      emailAccountId,
      supabaseClient: supabaseServiceClient,
    };

    await sendEmail(config, account.email_address, {
      subject,
      body: htmlBody,
      to: Array.isArray(to) ? to : [to],
      cc: cc && cc.length > 0 ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      bcc: bcc && bcc.length > 0 ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      replyTo,
      conversationId,
    });

    console.log(`✅ Email sent from mailbox: ${account.email_address} to: ${to}`);
    
    // Fetch the sent message ID for threading
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let sentMessageId = null;
    let sentInternetMessageId = null;
    
    try {
      const sentMessage = await graphAPIRequest<{ value: any[] }>(
        config,
        `/users/${account.email_address}/mailFolders/sentitems/messages?$top=1&$orderby=sentDateTime desc&$select=id,internetMessageId`
      );
      
      if (sentMessage.value && sentMessage.value.length > 0) {
        sentMessageId = sentMessage.value[0].id;
        sentInternetMessageId = sentMessage.value[0].internetMessageId;
        console.log("Retrieved sent message ID:", sentMessageId);
      }
    } catch (error) {
      console.error("Could not retrieve sent message ID:", error);
    }

    // Create message record in database
    const recipientEmail = Array.isArray(to) ? to[0] : to;
    const finalTicketId = ticketId || await getTicketIdFromAccount(supabaseServiceClient, emailAccountId, recipientEmail);
    
    if (finalTicketId) {
      const { error: messageError } = await supabaseServiceClient
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
          microsoft_message_id: sentMessageId,
          internet_message_id: sentInternetMessageId,
        });

      if (messageError) {
        console.error("Failed to create message record:", messageError);
      } else {
        console.log("Message record created successfully in helpdesk_messages");
      }
      
      // Update ticket's last_message_at
      await supabaseServiceClient
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