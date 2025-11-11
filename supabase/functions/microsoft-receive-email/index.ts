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

    for (const notification of notifications.value || []) {
      try {
        // Get the resource (email) from the notification
        const resourceUrl = notification.resource;
        
        // Extract email account ID from subscription client state if available
        const clientState = notification.clientState;
        
        if (!clientState) {
          console.warn("No client state in notification, skipping");
          continue;
        }

        // Get the email account
        const { data: account } = await supabaseClient
          .from("helpdesk_email_accounts")
          .select("*")
          .eq("microsoft_account_id", clientState)
          .single();

        if (!account) {
          console.warn("Email account not found for client state:", clientState);
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