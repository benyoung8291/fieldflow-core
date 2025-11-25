import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/microsoft-graph.ts";

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

    // Prepare test email content
    const testEmail = profile.email || user.email;
    const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';

    const htmlContent = `
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
        <p style="color: #666; font-size: 14px; margin: 30px;">
          If you received this email, your Help Desk email integration is working correctly!
        </p>
      </div>
    `;

    // Use shared Graph API module for sending
    const config = {
      emailAccountId: email_account_id,
      supabaseClient: supabaseServiceClient,
    };

    console.log(`Sending test email from mailbox: ${account.email_address} to: ${testEmail}`);
    
    await sendEmail(config, account.email_address, {
      subject: "Test Email - Help Desk Connection",
      body: htmlContent,
      to: [testEmail!],
    });

    console.log("✅ Test email sent successfully via Microsoft Graph API");

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
