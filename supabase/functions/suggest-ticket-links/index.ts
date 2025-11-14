import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailContent, senderEmail, subject } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are an AI assistant that analyzes emails and suggests relevant document links.
    
Based on the email content, sender, and subject, identify potential links to:
- Contacts (if sender matches a known contact)
- Customers (if email mentions customer names or accounts)
- Leads (if it's a sales inquiry or new business opportunity)
- Service Contracts (if it mentions ongoing services, contracts, or SLAs)
- Purchase Orders (if it's about orders, purchasing, or procurement)
- Suppliers (if sender is a vendor or mentions suppliers)

Return suggestions with confidence scores and reasoning.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze this email and suggest document links:\n\nFrom: ${senderEmail}\nSubject: ${subject}\n\nContent:\n${emailContent}` 
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_links",
            description: "Suggest relevant document links for the email",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { 
                        type: "string", 
                        enum: ["contact", "customer", "lead", "contract", "purchase_order", "supplier"]
                      },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                      reasoning: { type: "string" },
                      searchTerm: { type: "string", description: "What to search for in the database" }
                    },
                    required: ["type", "confidence", "reasoning", "searchTerm"]
                  }
                }
              },
              required: ["suggestions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_links" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments).suggestions;

    return new Response(
      JSON.stringify({ success: true, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error suggesting links:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
