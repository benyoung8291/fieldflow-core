import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  email_account_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email_account_id }: TestEmailRequest = await req.json();

    console.log("Testing email connection for account:", email_account_id);

    // Get email account
    const { data: emailAccount, error: accountError } = await supabase
      .from("helpdesk_email_accounts")
      .select("*")
      .eq("id", email_account_id)
      .single();

    if (accountError || !emailAccount) {
      throw new Error("Email account not found");
    }

    // Get authenticated user
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token || "");

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    const testEmail = profile?.email || user.email;

    // Send test email
    const emailResponse = await resend.emails.send({
      from: `${emailAccount.display_name || "Help Desk"} <${emailAccount.email_address}>`,
      to: [testEmail!],
      subject: "Test Email - Help Desk Connection",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">✅ Email Connection Successful</h2>
          <p>This is a test email from your Help Desk email account:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>Email Account:</strong> ${emailAccount.email_address}<br>
            <strong>Display Name:</strong> ${emailAccount.display_name || "Not set"}<br>
            <strong>Provider:</strong> ${emailAccount.provider}
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
    });

    console.log("Test email sent:", emailResponse);

    // Update email account status
    await supabase
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
        resend_id: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error testing email connection:", error);

    // Update email account with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { email_account_id } = await req.json();
      
      await supabase
        .from("helpdesk_email_accounts")
        .update({
          sync_error: error.message,
        })
        .eq("id", email_account_id);
    } catch (updateError) {
      console.error("Failed to update error status:", updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
