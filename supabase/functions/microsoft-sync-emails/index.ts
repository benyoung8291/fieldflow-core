import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchMessages, getValidAccessToken } from "../_shared/microsoft-graph.ts";
import { messageExists, findExistingTicket, extractThreadingHeaders } from "../_shared/email-deduplication.ts";

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

    // Use shared Graph API module for reliable, optimized access
    const config = {
      emailAccountId,
      supabaseClient: supabase,
    };

    // Validate access token (will refresh if needed)
    await getValidAccessToken(config);

    // Fetch messages using shared module (with retry logic and rate limiting)
    const messages = await fetchMessages(config, emailAccount.email_address, {
      top: 50,
      orderBy: "receivedDateTime desc",
    });

    console.log(`✅ Found ${messages.length} messages`);

    let syncedCount = 0;
    let errorCount = 0;

    // Process each email with improved error handling
    for (const message of messages) {
      try {
        // Check for duplicates using Microsoft message ID
        const isDuplicate = await messageExists(supabase, message.id);
        if (isDuplicate) {
          console.log(`⏭️ Message already synced: ${message.subject}`);
          continue;
        }

        // Extract threading identifiers
        const threadingData = extractThreadingHeaders(message);
        
        // Find existing ticket using multi-strategy approach
        const existingTicket = await findExistingTicket(
          supabase,
          emailAccountId,
          threadingData,
          message.subject || ""
        );

        // Extract sender info
        const senderEmail = message.from?.emailAddress?.address;
        const senderName = message.from?.emailAddress?.name;

        // Process attachments
        const attachments = message.attachments?.map((att: any) => ({
          name: att.name,
          contentType: att.contentType,
          size: att.size,
          id: att.id,
        })) || [];

        if (existingTicket) {
          // This is a reply - add message to existing ticket
          console.log(`📨 Adding reply to existing ticket: ${message.subject}`);
          
          const { error: messageError } = await supabase
            .from("helpdesk_messages")
            .insert({
              tenant_id: existingTicket.tenant_id,
              ticket_id: existingTicket.id,
              message_type: "email",
              direction: "inbound",
              sender_email: senderEmail,
              sender_name: senderName,
              to_email: emailAccount.email_address,
              subject: message.subject || "(No Subject)",
              body: message.body?.content || message.bodyPreview || "",
              body_html: message.body?.content || "",
              body_text: message.bodyPreview || "",
              microsoft_message_id: message.id,
              internet_message_id: message.internetMessageId,
              sent_at: message.receivedDateTime,
              attachments: attachments,
            });

          if (messageError) {
            console.error("Error creating reply message:", messageError);
            errorCount++;
          } else {
            // Update ticket's last_message_at and sync read status from Microsoft
            await supabase
              .from("helpdesk_tickets")
              .update({ 
                last_message_at: message.receivedDateTime,
                is_read: message.isRead || false
              })
              .eq("id", existingTicket.id);
            
            syncedCount++;
            console.log(`✅ Added reply to conversation: ${message.subject}`);
          }
        } else {
          // This is a new conversation - create new ticket
          console.log(`🆕 Creating new ticket: ${message.subject}`);

          // Try to find customer by email
          let customerId = null;
          let contactId = null;

          if (senderEmail) {
            // Look for contact first
            const { data: contact } = await supabase
              .from("customer_contacts")
              .select("id, customer_id")
              .eq("email", senderEmail)
              .maybeSingle();

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
              is_read: message.isRead || false,
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
              direction: "inbound",
              sender_email: senderEmail,
              sender_name: senderName,
              to_email: emailAccount.email_address,
              subject: message.subject || "(No Subject)",
              body: message.body?.content || message.bodyPreview || "",
              body_html: message.body?.content || "",
              body_text: message.bodyPreview || "",
              microsoft_message_id: message.id,
              internet_message_id: message.internetMessageId,
              sent_at: message.receivedDateTime,
              attachments: attachments,
            });

          if (messageError) {
            console.error("Error creating message:", messageError);
            errorCount++;
          } else {
            syncedCount++;
            console.log(`✅ Created new ticket: ${message.subject}`);
          }
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
    
    // Update account sync error
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      const { emailAccountId } = await req.json().catch(() => ({}));
      if (emailAccountId) {
        await supabase
          .from("helpdesk_email_accounts")
          .update({
            sync_status: "error",
            sync_error: errorMessage,
          })
          .eq("id", emailAccountId);
      }
    } catch (updateError) {
      console.error("Failed to update sync error:", updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
