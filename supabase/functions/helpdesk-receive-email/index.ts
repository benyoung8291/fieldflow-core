import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InboundEmail {
  from: string;
  from_name?: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

// Helper function to extract original sender from forwarded email
function extractOriginalSender(text: string, html: string, subject: string): {
  email: string | null;
  name: string | null;
  isForwarded: boolean;
} {
  const isForwarded = /^(fwd:|fw:)/i.test(subject.trim());
  
  if (!isForwarded) {
    return { email: null, name: null, isForwarded: false };
  }

  // Try multiple patterns to extract original sender
  const patterns = [
    // Gmail style
    /From:.*?<([^>]+)>/i,
    /From:\s*([^\s<]+@[^\s>]+)/i,
    // Outlook style
    /Original Message.*?From:.*?<([^>]+)>/is,
    /Original Message.*?From:\s*([^\s<]+@[^\s>]+)/is,
    // Generic patterns
    /forwarded message.*?from:.*?<([^>]+)>/is,
    /forwarded message.*?from:\s*([^\s<]+@[^\s>]+)/is,
  ];

  const content = html || text || "";
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const email = match[1].trim();
      
      // Try to extract name
      const namePattern = new RegExp(`From:\\s*([^<]+?)\\s*<${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`, 'i');
      const nameMatch = content.match(namePattern);
      
      return {
        email,
        name: nameMatch?.[1]?.trim() || null,
        isForwarded: true,
      };
    }
  }

  return { email: null, name: null, isForwarded: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailData: InboundEmail = await req.json();
    
    // Check if this is a forwarded email and extract original sender
    const forwardedInfo = extractOriginalSender(
      emailData.text || "",
      emailData.html || "",
      emailData.subject || ""
    );
    
    // Use original sender if detected, otherwise use the forwarder
    const actualSenderEmail = forwardedInfo.email || emailData.from;
    const actualSenderName = forwardedInfo.name || emailData.from_name || emailData.from;
    
    console.log("Received inbound email:", {
      from: emailData.from,
      actualSender: forwardedInfo.isForwarded ? actualSenderEmail : emailData.from,
      isForwarded: forwardedInfo.isForwarded,
      to: emailData.to,
      subject: emailData.subject,
    });

    // Find which email account this email was sent to
    const { data: emailAccounts, error: accountError } = await supabase
      .from("helpdesk_email_accounts")
      .select("*, pipeline:helpdesk_pipelines(*)")
      .in("email_address", emailData.to)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (accountError || !emailAccounts) {
      console.error("Email account not found:", accountError);
      return new Response(
        JSON.stringify({ error: "Email account not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found email account:", emailAccounts.email_address);

    // Check if this is a reply to an existing ticket (check In-Reply-To or References headers)
    const inReplyTo = emailData.headers?.["in-reply-to"] || emailData.headers?.["In-Reply-To"];
    const references = emailData.headers?.["references"] || emailData.headers?.["References"];
    
    let existingTicket = null;
    
    if (inReplyTo || references) {
      const messageIds = [inReplyTo, ...(references?.split(" ") || [])].filter(Boolean);
      
      const { data: existingMessages } = await supabase
        .from("helpdesk_messages")
        .select("ticket_id")
        .in("external_message_id", messageIds)
        .limit(1)
        .single();

      if (existingMessages) {
        const { data: ticket } = await supabase
          .from("helpdesk_tickets")
          .select("*")
          .eq("id", existingMessages.ticket_id)
          .single();
        
        existingTicket = ticket;
      }
    }

    // If no existing ticket found by message ID, try to match by sender email
    if (!existingTicket) {
      const { data: recentTickets } = await supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("pipeline_id", emailAccounts.pipeline_id)
        .or(`sender_email.eq.${actualSenderEmail},customer_id.not.is.null`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentTickets && recentTickets.length > 0) {
        // Check if any recent ticket matches this sender
        existingTicket = recentTickets.find(
          (t) => t.sender_email === actualSenderEmail && t.status !== "closed"
        );
      }
    }

    let ticketId: string;

    if (existingTicket) {
      // Add message to existing ticket
      ticketId = existingTicket.id;
      console.log("Adding message to existing ticket:", ticketId);

      // Update last_message_at and mark as unread when new message arrives
      await supabase
        .from("helpdesk_tickets")
        .update({
          last_message_at: new Date().toISOString(),
          is_read: false,
          status: existingTicket.status === "closed" ? "open" : existingTicket.status,
        })
        .eq("id", ticketId);
    } else {
      // Create new ticket
      console.log("Creating new ticket for:", emailData.from);

      // Try to find existing contact by email (use actual sender)
      let customerId = null;
      let supplierId = null;
      let leadId = null;
      let contactId = null;

      const { data: contact } = await supabase
        .from("contacts")
        .select("id, customer_id, supplier_id, lead_id")
        .ilike("email", actualSenderEmail)
        .limit(1)
        .single();

      if (contact) {
        customerId = contact.customer_id;
        supplierId = contact.supplier_id;
        leadId = contact.lead_id;
        contactId = contact.id;
      }

      // Generate ticket number
      const { data: ticketNumberResult } = await supabase.rpc(
        "get_next_sequential_number",
        {
          p_tenant_id: emailAccounts.tenant_id,
          p_entity_type: "ticket",
        }
      );

      const ticketNumber = ticketNumberResult || `TKT-${Date.now()}`;

      const { data: newTicket, error: ticketError } = await supabase
        .from("helpdesk_tickets")
        .insert({
          tenant_id: emailAccounts.tenant_id,
          pipeline_id: emailAccounts.pipeline_id,
          ticket_number: ticketNumber,
          subject: emailData.subject || "(No Subject)",
          status: "open",
          priority: "normal",
          customer_id: customerId,
          supplier_id: supplierId,
          lead_id: leadId,
          contact_id: contactId,
          sender_email: actualSenderEmail,
          sender_name: actualSenderName,
          forwarded_by: forwardedInfo.isForwarded ? emailData.from : null,
          is_read: false,
          first_message_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (ticketError || !newTicket) {
        console.error("Failed to create ticket:", ticketError);
        throw ticketError;
      }

      ticketId = newTicket.id;
      console.log("Created new ticket:", ticketId);
    }

    // Create message record
    const messageId = emailData.headers?.["message-id"] || 
                      emailData.headers?.["Message-ID"] || 
                      `${Date.now()}@helpdesk`;

    const { error: messageError } = await supabase
      .from("helpdesk_messages")
      .insert({
        tenant_id: emailAccounts.tenant_id,
        ticket_id: ticketId,
        message_type: "email",
        direction: "inbound",
        from_email: emailData.from,
        from_name: emailData.from_name || emailData.from,
        to_emails: emailData.to,
        subject: emailData.subject,
        body_html: emailData.html,
        body_plain: emailData.text,
        external_message_id: messageId,
        in_reply_to: inReplyTo,
        references: references?.split(" ").filter(Boolean) || [],
        attachments: emailData.attachments || [],
      });

    if (messageError) {
      console.error("Failed to create message:", messageError);
      throw messageError;
    }

    console.log("Successfully processed inbound email");

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticketId,
        message: "Email processed successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing inbound email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
