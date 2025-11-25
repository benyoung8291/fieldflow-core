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

    const { email_account_id } = await req.json();

    if (!email_account_id) {
      throw new Error("Missing email_account_id parameter");
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
      .eq("id", email_account_id)
      .single();

    if (accountError || !account) {
      throw new Error("Email account not found");
    }

    // Verify user belongs to the same tenant as the email account
    const { data: profile } = await supabaseServiceClient
      .from("profiles")
      .select("tenant_id, first_name, last_name, email")
      .eq("id", user.id)
      .single();

    if (!profile || profile.tenant_id !== account.tenant_id) {
      throw new Error("Unauthorized: User does not have access to this email account");
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabaseServiceClient, email_account_id);

    // Prepare test email
    const testEmail = profile.email || user.email;
    const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';

    const message = {
      message: {
        subject: "Test Email - Help Desk Connection",
        body: {
          contentType: "HTML",
          content: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">✅ Email Connection Successful</h2>
              <p>Hi ${userName},</p>
              <p>This is a test email from your Help Desk email account:</p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Email Account:</strong> ${account.email_address}<br>
                <strong>Display Name:</strong> ${account.display_name || account.email_address}<br>
                <strong>Provider:</strong> Microsoft 365
              </div>
              <p>Your email account is properly configured and ready to:</p>
              <ul>
                <li>Receive incoming emails and create tickets automatically</li>
                <li>Send replies to customers from the Help Desk</li>
                <li>Maintain email threading for better conversation tracking</li>
              </ul>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you received this email, your Help Desk email integration is working correctly!
              </p>
            </div>
          `,
        },
        toRecipients: [{
          emailAddress: { address: testEmail }
        }],
      },
      saveToSentItems: true,
    };

    // Send via Microsoft Graph API
    const sendEndpoint = `https://graph.microsoft.com/v1.0/users/${account.email_address}/sendMail`;
    
    console.log(`Sending test email from mailbox: ${account.email_address} to: ${testEmail}`);
    
    const response = await fetch(sendEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Microsoft Graph API error:", errorData);
      
      // Parse error for user-friendly message
      let errorMessage = `Failed to send test email: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.error && errorJson.error.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {
        // Use default error message
      }
      
      // Update email account with error
      await supabaseServiceClient
        .from("helpdesk_email_accounts")
        .update({
          sync_error: errorMessage,
        })
        .eq("id", email_account_id);

      throw new Error(errorMessage);
    }

    console.log("Test email sent successfully via Microsoft Graph API");

    // Update email account status on success
    await supabaseServiceClient
      .from("helpdesk_email_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq("id", email_account_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test email sent successfully",
        sent_to: testEmail,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-test-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
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
