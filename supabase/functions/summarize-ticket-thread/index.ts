import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { ticketId } = await req.json();

    if (!ticketId) {
      throw new Error("ticketId is required");
    }

    console.log("Fetching ticket and messages for:", ticketId);

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select("subject, status, priority")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) {
      console.error("Error fetching ticket:", ticketError);
      throw new Error("Error fetching ticket");
    }

    if (!ticket) {
      console.log("Ticket not found:", ticketId);
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Fetch all messages in chronological order
    const { data: messages, error: messagesError } = await supabase
      .from("helpdesk_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("message_type", "email")
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "No email conversation yet.",
          suggestedActions: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing ${messages.length} messages`);

    // Build conversation context
    const conversationText = messages
      .map((msg, idx) => {
        const direction = msg.direction === "inbound" ? "FROM CUSTOMER" : "TO CUSTOMER";
        const from = msg.from_name || msg.from_email || "Unknown";
        const body = msg.body_plain || msg.body_html?.replace(/<[^>]*>/g, "") || "";
        return `[Message ${idx + 1}] ${direction} - ${from}:\n${body}\n`;
      })
      .join("\n---\n\n");

    // Call Lovable AI for summary
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing customer support email threads. Your job is to:
1. Provide a concise summary of the conversation highlighting key points and any evolution in the discussion
2. Identify the current status and what has been resolved or agreed upon
3. Suggest 3-5 specific, actionable next steps

Focus on the most recent developments and any changes in plans or decisions throughout the thread.`,
          },
          {
            role: "user",
            content: `Ticket: ${ticket.subject}
Status: ${ticket.status}
Priority: ${ticket.priority}

Email Thread (in chronological order):
${conversationText}

Please provide:
1. A brief summary (2-3 sentences) of the conversation, emphasizing recent developments
2. Current status of what's been discussed
3. 3-5 specific suggested actions for next steps`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_summary",
              description: "Provide a structured summary of the email thread with suggested actions",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "2-3 sentence summary highlighting key points and recent developments",
                  },
                  currentStatus: {
                    type: "string",
                    description: "Brief statement of what has been resolved or agreed upon",
                  },
                  suggestedActions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", description: "Specific action to take" },
                        priority: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                          description: "Priority level",
                        },
                        type: {
                          type: "string",
                          enum: ["reply", "task", "follow-up", "escalate", "research"],
                          description: "Type of action",
                        },
                      },
                      required: ["action", "priority", "type"],
                    },
                    minItems: 3,
                    maxItems: 5,
                  },
                },
                required: ["summary", "currentStatus", "suggestedActions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a moment.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add funds to continue.");
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error("Failed to generate summary");
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in summarize-ticket-thread:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
