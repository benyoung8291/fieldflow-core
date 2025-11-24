import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getMicrosoftCredentials, updateMicrosoftTokens } from "../_shared/vault-credentials.ts";

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

    // Get credentials from vault
    const credentials = await getMicrosoftCredentials(supabase, emailAccountId);

    // Check if token needs refresh
    let accessToken = credentials.access_token;
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
            client_secret: credentials.client_secret || Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
            grant_type: "refresh_token",
            refresh_token: credentials.refresh_token,
            scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Failed to refresh token:", errorText);
        
        // Update email account with specific error
        await supabase
          .from("helpdesk_email_accounts")
          .update({
            sync_status: "error",
            sync_error: "Microsoft authentication expired. Please reconnect your email account in Settings > Help Desk > Email Accounts.",
          })
          .eq("id", emailAccountId);
        
        // Return error response instead of throwing
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Microsoft authentication expired. Please reconnect your email account."
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      // Update the token in vault and database
      await updateMicrosoftTokens(supabase, emailAccountId, tokenData.access_token, tokenData.refresh_token);
      
      await supabase
        .from("helpdesk_email_accounts")
        .update({
          microsoft_token_expires_at: new Date(
            Date.now() + tokenData.expires_in * 1000
          ).toISOString(),
        })
        .eq("id", emailAccountId);

      console.log("✅ Token refreshed successfully");
    }

    // Fetch emails from Microsoft Graph API - include all threading fields
    const messagesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${emailAccount.email_address}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead,conversationId,internetMessageId,internetMessageHeaders,hasAttachments&$expand=attachments`,
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
        // Check if this specific message already exists
        const { data: existingMessage } = await supabase
          .from("helpdesk_messages")
          .select("id")
          .eq("microsoft_message_id", message.id)
          .single();

        if (existingMessage) {
          console.log(`⏭️ Message already synced: ${message.subject}`);
          continue;
        }

        // Check if this is a reply to an existing conversation
        let existingTicket = null;
        
        // Extract email threading headers (In-Reply-To and References)
        let inReplyTo = null;
        let references: string[] = [];
        
        if (message.internetMessageHeaders) {
          for (const header of message.internetMessageHeaders) {
            if (header.name === "In-Reply-To") {
              inReplyTo = header.value;
            } else if (header.name === "References") {
              // References header contains space-separated Message-IDs
              references = header.value.split(/\s+/).filter((id: string) => id.length > 0);
            }
          }
        }
        
        console.log(`📧 Processing message - In-Reply-To: ${inReplyTo}, References: ${references.length} IDs`);
        
        // FIRST TRY: Match by In-Reply-To header (most reliable - standard email threading)
        if (inReplyTo && !existingTicket) {
          console.log(`🔍 Looking for ticket with internet_message_id: ${inReplyTo}`);
          const { data: messages } = await supabase
            .from("helpdesk_messages")
            .select("ticket_id, helpdesk_tickets!inner(id, tenant_id, subject)")
            .eq("internet_message_id", inReplyTo)
            .eq("helpdesk_tickets.email_account_id", emailAccount.id)
            .limit(1);
          
          if (messages && messages.length > 0) {
            console.log(`✅ Found ticket by In-Reply-To header: ${messages[0].ticket_id}`);
            existingTicket = {
              id: messages[0].ticket_id,
              tenant_id: (messages[0] as any).helpdesk_tickets.tenant_id,
              subject: (messages[0] as any).helpdesk_tickets.subject,
            };
          }
        }
        
        // SECOND TRY: Match by References header (check all Message-IDs in the chain)
        if (references.length > 0 && !existingTicket) {
          console.log(`🔍 Looking for ticket in References chain (${references.length} IDs)`);
          const { data: messages } = await supabase
            .from("helpdesk_messages")
            .select("ticket_id, helpdesk_tickets!inner(id, tenant_id, subject)")
            .in("internet_message_id", references)
            .eq("helpdesk_tickets.email_account_id", emailAccount.id)
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (messages && messages.length > 0) {
            console.log(`✅ Found ticket by References header: ${messages[0].ticket_id}`);
            existingTicket = {
              id: messages[0].ticket_id,
              tenant_id: (messages[0] as any).helpdesk_tickets.tenant_id,
              subject: (messages[0] as any).helpdesk_tickets.subject,
            };
          }
        }
        
        // THIRD TRY: Match by Microsoft conversationId
        if (message.conversationId && !existingTicket) {
          console.log(`🔍 Looking for ticket with conversationId: ${message.conversationId}`);
          const { data: ticket } = await supabase
            .from("helpdesk_tickets")
            .select("id, tenant_id, subject")
            .eq("microsoft_conversation_id", message.conversationId)
            .eq("email_account_id", emailAccount.id)
            .maybeSingle();
          
          if (ticket) {
            console.log(`✅ Found ticket by conversationId: ${ticket.id}`);
            existingTicket = ticket;
          }
        }
        
        // FOURTH TRY (FALLBACK): Match by subject if it's a reply (least reliable)
        // Prioritize non-archived tickets to avoid threading replies to archived conversations
        if (!existingTicket && message.subject) {
          const isReply = message.subject.startsWith("RE:") || message.subject.startsWith("Re:");
          if (isReply) {
            // Remove "RE:" or "Re:" prefix and trim
            const cleanSubject = message.subject.replace(/^(RE:|Re:)\s*/i, "").trim();
            console.log(`⚠️ Falling back to subject matching (unreliable): ${cleanSubject}`);
            
            // First try: non-archived tickets only
            const { data: activeTicket } = await supabase
              .from("helpdesk_tickets")
              .select("id, tenant_id, subject")
              .eq("email_account_id", emailAccount.id)
              .eq("is_archived", false)
              .ilike("subject", cleanSubject)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (activeTicket) {
              console.log(`✅ Found active ticket by subject match: ${activeTicket.id}`);
              existingTicket = activeTicket;
            } else {
              // Fallback: check archived tickets only if no active match found
              console.log(`🔍 No active ticket found, checking archived tickets`);
              const { data: archivedTicket } = await supabase
                .from("helpdesk_tickets")
                .select("id, tenant_id, subject")
                .eq("email_account_id", emailAccount.id)
                .eq("is_archived", true)
                .ilike("subject", cleanSubject)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (archivedTicket) {
                console.log(`✅ Found archived ticket by subject match: ${archivedTicket.id}`);
                existingTicket = archivedTicket;
              }
            }
          }
        }

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
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
