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

    // Microsoft Graph webhook validation
    const validationToken = req.headers.get("validationToken");
    if (validationToken) {
      console.log("Webhook validation request received");
      return new Response(validationToken, {
        headers: { "Content-Type": "text/plain" },
        status: 200,
      });
    }

    const notifications = await req.json();
    console.log("Received notifications:", JSON.stringify(notifications, null, 2));

    // Validate notification structure
    if (!notifications.value || !Array.isArray(notifications.value)) {
      console.error("Invalid notification structure: missing or invalid 'value' array");
      return new Response(
        JSON.stringify({ error: "Invalid notification structure" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    for (const notification of notifications.value) {
      try {
        // Validate required notification fields
        if (!notification.subscriptionId || !notification.resource || !notification.clientState) {
          console.warn("Notification missing required fields, skipping");
          continue;
        }

        // Get the resource (email) from the notification
        const resourceUrl = notification.resource;
        
        // Validate resource URL format (must be a Microsoft Graph messages endpoint)
        if (!resourceUrl.includes('/messages/')) {
          console.warn("Invalid resource URL format, skipping:", resourceUrl);
          continue;
        }
        
        // Extract email account ID from subscription client state
        const clientState = notification.clientState;
        
        // Validate clientState format (should be a UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(clientState)) {
          console.warn("Invalid clientState format, skipping:", clientState);
          continue;
        }

        // Get the email account and verify it exists with matching subscription
        const { data: account, error: accountError } = await supabaseClient
          .from("helpdesk_email_accounts")
          .select("*")
          .eq("microsoft_account_id", clientState)
          .eq("is_active", true)
          .single();

        if (accountError || !account) {
          console.warn("Email account not found or inactive for client state:", clientState);
          continue;
        }

        // Verify the account belongs to a valid tenant
        const { data: tenant, error: tenantError } = await supabaseClient
          .from("tenants")
          .select("id")
          .eq("id", account.tenant_id)
          .single();

        if (tenantError || !tenant) {
          console.error("Invalid tenant for account:", account.tenant_id);
          continue;
        }

        // Fetch the email content using Graph API
        const emailResponse = await fetch(
          `https://graph.microsoft.com/v1.0/${resourceUrl}`,
          {
            headers: {
              Authorization: `Bearer ${account.microsoft_access_token}`,
            },
          }
        );

        if (!emailResponse.ok) {
          console.error("Failed to fetch email:", await emailResponse.text());
          continue;
        }

        const email = await emailResponse.json();

        // Extract sender email
        const senderEmail = email.from?.emailAddress?.address || null;
        
        // Try to find existing contact by email
        let customerId = null;
        let supplierId = null;
        let leadId = null;
        let contactId = null;

        if (senderEmail) {
          const { data: contact } = await supabaseClient
            .from("contacts")
            .select("id, customer_id, supplier_id, lead_id")
            .ilike("email", senderEmail)
            .limit(1)
            .single();

          if (contact) {
            customerId = contact.customer_id;
            supplierId = contact.supplier_id;
            leadId = contact.lead_id;
            contactId = contact.id;
          }
        }

        // Create ticket from email
        const { error: ticketError } = await supabaseClient
          .from("helpdesk_tickets")
          .insert({
            tenant_id: account.tenant_id,
            pipeline_id: account.pipeline_id,
            stage_id: null, // Will be set by trigger or default
            subject: email.subject,
            description: email.bodyPreview,
            status: "open",
            priority: "medium",
            email_thread_id: email.conversationId,
            sender_email: senderEmail,
            sender_name: email.from?.emailAddress?.name || senderEmail,
            customer_id: customerId,
            supplier_id: supplierId,
            lead_id: leadId,
            contact_id: contactId,
            created_by: account.id,
          });

        if (ticketError) {
          console.error("Error creating ticket:", ticketError);
          continue;
        }

        console.log("Ticket created from email:", email.subject);
      } catch (error) {
        console.error("Error processing notification:", error);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-receive-email:", error);
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