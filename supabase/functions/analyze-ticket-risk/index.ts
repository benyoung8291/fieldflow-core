import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ticket details with messages
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select(`
        *,
        customer:customers(name),
        pipeline:helpdesk_pipelines(name),
        assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(first_name, last_name)
      `)
      .eq("id", ticketId)
      .single();

    if (ticketError) throw ticketError;

    const { data: messages, error: messagesError } = await supabase
      .from("helpdesk_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    // Build context for AI
    const threadContext = messages
      ?.map(m => `[${m.is_from_customer ? "Customer" : "Support"}]: ${m.message_text}`)
      .join("\n") || "";

    const ticketAge = Math.floor(
      (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
    );

    const lastMessageTime = ticket.last_message_at 
      ? Math.floor((new Date().getTime() - new Date(ticket.last_message_at).getTime()) / (1000 * 60 * 60))
      : ticketAge;

    const systemPrompt = `You are a customer service analyst. Analyze the support ticket thread and identify potential bottlenecks or issues that could lead to poor customer experience.

Ticket Details:
- Created: ${ticketAge} hours ago
- Last Activity: ${lastMessageTime} hours ago
- Assigned to: ${ticket.assigned_user ? `${ticket.assigned_user.first_name} ${ticket.assigned_user.last_name}` : "Unassigned"}
- Pipeline: ${ticket.pipeline?.name || "Unknown"}
- Customer: ${ticket.customer?.name || ticket.external_email || "Unknown"}
- Messages: ${messages?.length || 0}

Thread:
${threadContext}

Provide a concise analysis (2-3 sentences) identifying:
1. The main bottleneck or delay causing the risk
2. What needs to happen to resolve this issue
Keep it actionable and specific.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze this ticket and identify the bottleneck." }
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Unable to analyze ticket at this time.";

    return new Response(
      JSON.stringify({ 
        analysis,
        ticketAge,
        lastMessageTime,
        messageCount: messages?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error analyzing ticket:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
