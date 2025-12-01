import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticketId, message } = await req.json();

    if (!ticketId) {
      throw new Error("Missing ticketId");
    }

    // Get ticket details with customer info
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select(`
        *,
        customer:customers(id, name, email)
      `)
      .eq("id", ticketId)
      .single();

    if (ticketError) throw ticketError;
    if (!ticket) throw new Error("Ticket not found");

    // Get all customer portal users for this customer
    const { data: portalUsers, error: usersError } = await supabase
      .from("customer_portal_users")
      .select("user_id, email, first_name, last_name")
      .eq("customer_id", ticket.customer_id)
      .eq("is_active", true);

    if (usersError) throw usersError;

    // Create in-app notifications for all portal users
    if (portalUsers && portalUsers.length > 0) {
      const notifications = portalUsers.map((user) => ({
        tenant_id: ticket.tenant_id,
        user_id: user.user_id,
        type: "request_completed",
        title: "Service Request Completed",
        message: `Your service request "${ticket.subject}" has been completed.`,
        link: `/customer/requests/${ticketId}`,
        metadata: {
          ticket_id: ticketId,
          ticket_number: ticket.ticket_number,
        },
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Failed to create notifications:", notifError);
      }
    }

    // TODO: Send email notification if email integration is configured
    // This would be added when email sending is set up

    return new Response(
      JSON.stringify({
        success: true,
        notifiedUsers: portalUsers?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error notifying customer:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
