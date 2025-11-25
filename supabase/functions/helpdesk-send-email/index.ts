import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  ticket_id: string;
  body_html?: string;
  body_text: string;
  subject?: string;
  reply_to_message_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticket_id, body_html, body_text, subject, reply_to_message_id }: SendEmailRequest = 
      await req.json();

    console.log("Sending email for ticket:", ticket_id);

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select(`
        *,
        pipeline:helpdesk_pipelines(*),
        customer:customers(name, email),
        contact:customer_contacts(first_name, last_name, email)
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket not found");
    }

    // Get email account for this pipeline
    const { data: emailAccount, error: accountError } = await supabase
      .from("helpdesk_email_accounts")
      .select("*")
      .eq("pipeline_id", ticket.pipeline_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (accountError || !emailAccount) {
      throw new Error("No active email account configured for this pipeline");
    }

    // Determine recipient email
    const recipientEmail = ticket.contact?.email || 
                          ticket.customer?.email || 
                          ticket.external_email;

    if (!recipientEmail) {
      throw new Error("No recipient email found for ticket");
    }

    // Get the authenticated user who is sending
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

    const senderName = profile 
      ? `${profile.first_name} ${profile.last_name}`.trim() 
      : emailAccount.display_name || "Support";

    // Get previous message if this is a reply
    let inReplyTo = null;
    
    if (reply_to_message_id) {
      const { data: previousMessage } = await supabase
        .from("helpdesk_messages")
        .select("email_message_id")
        .eq("id", reply_to_message_id)
        .single();

      if (previousMessage) {
        inReplyTo = previousMessage.email_message_id;
      }
    }

    // Generate message ID
    const messageId = `${Date.now()}-${ticket_id}@${emailAccount.email_address.split("@")[1]}`;

    // Validate Resend API key exists
    if (!Deno.env.get("RESEND_API_KEY")) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Send email via Resend
    const emailSubject = subject || `Re: ${ticket.subject}`;
    
    const emailResponse = await resend.emails.send({
      from: `${senderName} <${emailAccount.email_address}>`,
      to: [recipientEmail],
      subject: emailSubject,
      html: body_html || (body_text ? `<p>${body_text.replace(/\n/g, "<br>")}</p>` : ''),
      text: body_text || '',
      headers: {
        "Message-ID": messageId,
        ...(inReplyTo && { "In-Reply-To": inReplyTo }),
        "X-Ticket-Number": ticket.ticket_number,
      },
    });

    // Critical: Check if Resend returned an error
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error.message);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully. Resend ID:", emailResponse.data?.id);

    // Create message record
    const { error: messageError } = await supabase
      .from("helpdesk_messages")
      .insert({
        tenant_id: ticket.tenant_id,
        ticket_id: ticket_id,
        message_type: "email",
        direction: "outbound",
        from_email: emailAccount.email_address,
        from_name: senderName,
        to_email: recipientEmail,
        subject: emailSubject,
        body_html: body_html,
        body_text: body_text,
        email_message_id: messageId,
        created_by: user.id,
      });

    if (messageError) {
      console.error("Failed to create message record:", messageError);
      throw messageError;
    }

    // Update ticket's last_message_at
    await supabase
      .from("helpdesk_tickets")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", ticket_id);

    console.log("Email sent and recorded successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        resend_id: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
