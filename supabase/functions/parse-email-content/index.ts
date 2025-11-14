import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailContent, extractionType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Define system prompts based on extraction type
    const systemPrompts: Record<string, string> = {
      invoice: `Extract invoice data from the email. Return a JSON object with:
- vendor_name: string (supplier/vendor name)
- invoice_number: string
- invoice_date: string (ISO format)
- due_date: string (ISO format)
- total_amount: number
- tax_amount: number
- description: string (brief description)
- line_items: array of {description: string, quantity: number, unit_price: number, amount: number}
Return ONLY valid JSON, no markdown formatting.`,
      
      purchase_order: `Extract purchase order data from the email. Return a JSON object with:
- vendor_name: string (supplier name)
- description: string (what is being ordered)
- expected_delivery_date: string (ISO format if mentioned)
- total_amount: number (if mentioned)
- notes: string (additional notes)
- line_items: array of {description: string, quantity: number, unit_price: number}
Return ONLY valid JSON, no markdown formatting.`,
      
      service_order: `Extract service order data from the email. Return a JSON object with:
- title: string (brief title of the service needed)
- description: string (detailed description)
- priority: string ("low", "medium", or "high")
- requested_date: string (ISO format if mentioned)
- location: string (if mentioned)
- contact_name: string
- contact_email: string
- contact_phone: string
Return ONLY valid JSON, no markdown formatting.`,
      
      contact: `Extract contact information from the email. Return a JSON object with:
- first_name: string
- last_name: string
- email: string
- phone: string
- company: string (if mentioned)
- position: string (job title if mentioned)
Return ONLY valid JSON, no markdown formatting.`,
      
      lead: `Extract lead information from the email. Return a JSON object with:
- company_name: string
- contact_name: string
- email: string
- phone: string
- source: string ("Email")
- description: string (brief description of the lead/opportunity)
- estimated_value: number (if mentioned)
- status: string ("new")
Return ONLY valid JSON, no markdown formatting.`,
    };

    const systemPrompt = systemPrompts[extractionType] || systemPrompts.contact;

    console.log(`Parsing email content for ${extractionType}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this email and extract the relevant information:\n\n${emailContent}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to parse email content");
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error("No content in AI response");
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedText = extractedText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedText);
      throw new Error("Invalid JSON response from AI");
    }

    console.log("Successfully parsed email content:", parsedData);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-email-content function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
