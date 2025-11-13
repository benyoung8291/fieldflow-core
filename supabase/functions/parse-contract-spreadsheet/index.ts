import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetData, customerId } = await req.json();
    
    if (!spreadsheetData || !Array.isArray(spreadsheetData) || spreadsheetData.length === 0) {
      throw new Error("Invalid spreadsheet data");
    }

    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Create a supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header to fetch tenant_id
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    // Get user and tenant info
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Unable to get tenant information");
    }

    const tenantId = profile.tenant_id;

    // Fetch existing locations for this customer
    const { data: locations } = await supabase
      .from("customer_locations")
      .select("id, name, address, city, state, postcode")
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .limit(50);

    console.log("Sending to AI for parsing...");
    
    // Limit spreadsheet data to prevent token overflow
    const limitedSpreadsheetData = spreadsheetData.slice(0, 100);
    
    // Use Lovable AI with structured output to parse the spreadsheet
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at parsing service contract spreadsheets. Extract line items for a single service contract.

CRITICAL MAPPING RULES:
- Location name: Use the Suburb column value
- Location address: Use the Address column value (include full street address)
- Description: Use the Address column value
- Frequency mapping: "6 Monthly" = "monthly", "Monthly" = "monthly", "Quarterly" = "quarterly", "Annually" = "annually", "Weekly" = "weekly"
- Unit price: Extract from "TOTAL per clean ($)" column (remove $ and commas)
- Quantity: Always 1
- Start date: Convert Month 1 value to date format YYYY-MM-DD. Month names (Jul, Aug, Sep, etc.) should use 2025 as year. Jul=2025-07-01, Aug=2025-08-01, etc.
- State: Use State column value

Match existing locations by comparing Suburb name and Address.`
          },
          {
            role: "user",
            content: `Parse this service contract spreadsheet into line items. Each row represents one location/service.

Sample data structure (first few rows):
${JSON.stringify(limitedSpreadsheetData.slice(0, 5), null, 2)}

Existing customer locations to match against:
${JSON.stringify(locations || [], null, 2)}

Parse ALL ${limitedSpreadsheetData.length} rows into line items.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_line_items",
              description: "Extract service contract line items from spreadsheet",
              parameters: {
                type: "object",
                properties: {
                  lineItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string", description: "Full street address from Address column" },
                        quantity: { type: "number", description: "Always 1 for these service contracts" },
                        unit_price: { type: "number", description: "Dollar amount from TOTAL per clean column (no $ or commas)" },
                        recurrence_frequency: { type: "string", enum: ["weekly", "monthly", "quarterly", "annually"], description: "Converted from Frequency column: 6 Monthly=monthly, Monthly=monthly, etc." },
                        first_generation_date: { type: "string", description: "Start date from Month 1 column converted to YYYY-MM-DD (use 2025 as year)" },
                        location: {
                          type: "object",
                          properties: {
                            existingLocationId: { type: "string", description: "ID if Suburb and Address match existing location" },
                            name: { type: "string", description: "Suburb name from Suburb column" },
                            address: { type: "string", description: "Full street address from Address column" },
                            city: { type: "string", description: "Suburb value" },
                            state: { type: "string", description: "State from State column (NSW, VIC, etc.)" },
                            postcode: { type: "string", description: "Postcode if available" }
                          },
                          required: ["name", "address", "state"]
                        }
                      },
                      required: ["description", "quantity", "unit_price", "recurrence_frequency", "first_generation_date", "location"]
                    }
                  }
                },
                required: ["lineItems"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_line_items" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI parsing failed");
    }

    const result = await aiResponse.json();
    console.log("AI Response:", JSON.stringify(result, null, 2));

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No structured output from AI");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed line items:", JSON.stringify(parsedData, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        lineItems: parsedData.lineItems,
        tenantId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error parsing spreadsheet:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
