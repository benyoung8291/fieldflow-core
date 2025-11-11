import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailAccountId } = await req.json();

    if (!emailAccountId) {
      throw new Error("Email account ID is required");
    }

    console.log("📧 Starting email sync for account:", emailAccountId);

    // Get the email account details
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: emailAccount, error: accountError } = await supabase
      .from("helpdesk_email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .single();

    if (accountError || !emailAccount) {
      throw new Error("Email account not found");
    }

    console.log("📬 Fetching emails for:", emailAccount.email_address);

    // Check if token needs refresh
    let accessToken = emailAccount.microsoft_access_token;
    const tokenExpiresAt = new Date(emailAccount.microsoft_token_expires_at);
    const now = new Date();

    if (tokenExpiresAt <= now) {
      console.log("🔄 Access token expired, refreshing...");
      
      // Refresh the token
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${Deno.env.get("MICROSOFT_TENANT_ID")}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
            client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
            grant_type: "refresh_token",
            refresh_token: emailAccount.microsoft_refresh_token,
            scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Failed to refresh token:", errorText);
        throw new Error("Failed to refresh access token");
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update the token in the database
      await supabase
        .from("helpdesk_email_accounts")
        .update({
          microsoft_access_token: tokenData.access_token,
          microsoft_refresh_token: tokenData.refresh_token,
          microsoft_token_expires_at: new Date(
            Date.now() + tokenData.expires_in * 1000
          ).toISOString(),
        })
        .eq("id", emailAccountId);

      console.log("✅ Token refreshed successfully");
    }

    // Fetch emails from Microsoft Graph API
    const messagesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${emailAccount.email_address}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,body,isRead,conversationId`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error("Failed to fetch messages:", errorText);
      
      // Update sync error
      await supabase
        .from("helpdesk_email_accounts")
        .update({
          sync_status: "error",
          sync_error: `Failed to fetch emails: ${errorText}`,
        })
        .eq("id", emailAccountId);
      
      throw new Error("Failed to fetch emails from Microsoft");
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.value || [];

    console.log(`✅ Found ${messages.length} messages`);

    let syncedCount = 0;
    let errorCount = 0;

    // Process each email
    for (const message of messages) {
      try {
        // Check if ticket already exists for this message
        const { data: existingTicket } = await supabase
          .from("helpdesk_tickets")
          .select("id")
          .eq("microsoft_message_id", message.id)
          .single();

        if (existingTicket) {
          console.log(`⏭️ Ticket already exists for message: ${message.subject}`);
          continue;
        }

        // Extract sender info
        const senderEmail = message.from?.emailAddress?.address;
        const senderName = message.from?.emailAddress?.name;

        // Try to find customer by email
        let customerId = null;
        let contactId = null;

        if (senderEmail) {
          // Look for contact first
          const { data: contact } = await supabase
            .from("customer_contacts")
            .select("id, customer_id")
            .eq("email", senderEmail)
            .single();

          if (contact) {
            contactId = contact.id;
            customerId = contact.customer_id;
          }
        }

        // Create the ticket
        const { data: ticket, error: ticketError } = await supabase
          .from("helpdesk_tickets")
          .insert({
            tenant_id: emailAccount.tenant_id,
            pipeline_id: emailAccount.pipeline_id,
            email_account_id: emailAccount.id,
            ticket_number: `HD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            subject: message.subject || "(No Subject)",
            status: "open",
            priority: "medium",
            customer_id: customerId,
            contact_id: contactId,
            sender_email: senderEmail,
            sender_name: senderName,
            external_email: customerId ? null : senderEmail,
            microsoft_message_id: message.id,
            microsoft_conversation_id: message.conversationId,
            last_message_at: message.receivedDateTime,
          })
          .select()
          .single();

        if (ticketError) {
          console.error("Error creating ticket:", ticketError);
          errorCount++;
          continue;
        }

        // Create the initial message
        const { error: messageError } = await supabase
          .from("helpdesk_messages")
          .insert({
            tenant_id: emailAccount.tenant_id,
            ticket_id: ticket.id,
            message_type: "email",
            sender_email: senderEmail,
            sender_name: senderName,
            body_html: message.body?.content || message.bodyPreview || "",
            body_text: message.bodyPreview || "",
            is_from_customer: true,
            microsoft_message_id: message.id,
            sent_at: message.receivedDateTime,
          });

        if (messageError) {
          console.error("Error creating message:", messageError);
          errorCount++;
        } else {
          syncedCount++;
          console.log(`✅ Created ticket: ${message.subject}`);
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        errorCount++;
      }
    }

    // Update last sync time
    await supabase
      .from("helpdesk_email_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: "success",
        sync_error: null,
      })
      .eq("id", emailAccountId);

    console.log(`🎉 Sync complete: ${syncedCount} new tickets, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount,
        errorCount,
        totalMessages: messages.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-sync-emails:", error);
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
