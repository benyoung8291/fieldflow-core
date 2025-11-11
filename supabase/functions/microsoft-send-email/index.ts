import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

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

    const { emailAccountId, to, subject, body, replyTo } = await req.json();

    // Get valid access token
    const accessToken = await getValidAccessToken(supabaseClient, emailAccountId);

    // Get account details
    const { data: account } = await supabaseClient
      .from("helpdesk_email_accounts")
      .select("*")
      .eq("id", emailAccountId)
      .single();

    // Prepare email message
    const message = {
      message: {
        subject: subject,
        body: {
          contentType: "HTML",
          content: body,
        },
        toRecipients: Array.isArray(to) ? to.map((email: string) => ({
          emailAddress: { address: email }
        })) : [{
          emailAddress: { address: to }
        }],
        ...(replyTo && {
          replyTo: [{
            emailAddress: { address: replyTo }
          }]
        }),
      },
      saveToSentItems: true,
    };

    // Send via Microsoft Graph API
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
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