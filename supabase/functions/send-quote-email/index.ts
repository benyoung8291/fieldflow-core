import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  quote_id: string;
  to: string;
  subject: string;
  message: string;
  pdf_html: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { quote_id, to, subject, message, pdf_html }: EmailData = await req.json();

    // Fetch quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('quote_number, tenant_id')
      .eq('id', quote_id)
      .single();

    if (quoteError) throw quoteError;

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.tenant_id !== quote.tenant_id) {
      throw new Error('Unauthorized access to quote');
    }

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0891B2; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Quotation ${quote.quote_number}</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>
        <div style="padding: 20px; background: white;">
          <p style="margin: 0 0 15px 0;"><strong>Quote Details:</strong></p>
          ${pdf_html}
        </div>
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e5e7eb;">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'quotes@resend.dev',
      to: [to],
      subject: subject,
      html: emailHTML,
    });

    if (emailError || !emailResult) throw emailError || new Error('Failed to send email');

    // Track email in database
    await supabase.from('quote_emails').insert({
      tenant_id: profile.tenant_id,
      quote_id: quote_id,
      sent_to: to,
      sent_by: user.id,
      subject: subject,
      message: message,
    });

    console.log('Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});