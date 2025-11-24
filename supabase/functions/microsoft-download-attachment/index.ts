import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { emailAccountId, messageId, attachmentId } = await req.json();

    if (!emailAccountId || !messageId || !attachmentId) {
      throw new Error("Missing required parameters");
    }

    // Get email account credentials
    const { data: emailAccount, error: accountError } = await supabaseClient
      .from("helpdesk_email_accounts")
      .select("microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at")
      .eq("id", emailAccountId)
      .single();

    if (accountError || !emailAccount) {
      throw new Error("Email account not found");
    }

    let accessToken = emailAccount.microsoft_access_token;

    // Check if token needs refresh
    if (emailAccount.microsoft_token_expires_at) {
      const expiresAt = new Date(emailAccount.microsoft_token_expires_at);
      if (expiresAt <= new Date()) {
        // Token expired, refresh it
        const refreshResponse = await supabaseClient.functions.invoke(
          "microsoft-refresh-token",
          {
            body: { emailAccountId },
          }
        );

        if (refreshResponse.error) {
          throw new Error("Failed to refresh token");
        }

        accessToken = refreshResponse.data.access_token;
      }
    }

    // Download attachment from Microsoft Graph API
    const attachmentUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`;
    
    const response = await fetch(attachmentUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    // Get the attachment content
    const attachmentData = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    // Return the attachment with appropriate headers
    return new Response(attachmentData, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": "attachment",
      },
    });
  } catch (error) {
    console.error("Error downloading attachment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
