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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing and parsing service contract spreadsheets of any format. Your job is to intelligently understand the data structure and extract service contract line items.

ANALYSIS APPROACH:
1. Examine the column headers and data to understand what information is available
2. Identify which columns contain address/location information, pricing, frequency, dates, and service descriptions
3. Extract meaningful data for each line item

EXTRACTION GUIDELINES:
- Description: Use the most descriptive field available (address, service description, or property identifier)
- Location name: Preferably use suburb/city name if available, otherwise use a location identifier
- Location address: Extract full street address
- Quantity: Default to 1 unless a quantity field is clearly present
- Unit price: Find pricing information (look for columns with $, price, cost, amount, rate, etc.) - remove currency symbols and commas, convert to number
- Frequency: Identify service frequency - convert any format to one of: weekly, monthly, quarterly, annually (interpret "6 Monthly" as "monthly", "Bi-monthly" as "monthly", etc.)
- Start date: Find start date, first service date, or month indicators - convert to YYYY-MM-DD format (use 2025 as default year if not specified)
- State: Extract state/province code if available

LOCATION MATCHING:
- Compare extracted location names and addresses against existing customer locations
- Match if the location name (suburb/city) and address are similar
- Set existingLocationId if a match is found

Be intelligent and flexible - spreadsheet formats vary widely. Focus on extracting the core information needed for service contracts.`
          },
          {
            role: "user",
            content: `Analyze and parse this service contract spreadsheet. Each row should become a line item.

Data preview (showing structure and first few rows):
${JSON.stringify(limitedSpreadsheetData.slice(0, 3), null, 2)}

Total rows to process: ${limitedSpreadsheetData.length}

Existing customer locations for matching:
${JSON.stringify(locations || [], null, 2)}

Analyze the data structure, identify the relevant columns, and extract all line items with their location information.`
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
                        description: { type: "string", description: "Service description or address - use most descriptive field available" },
                        quantity: { type: "number", description: "Service quantity (default 1 if not specified)" },
                        unit_price: { type: "number", description: "Price per service as number (no currency symbols)" },
                        recurrence_frequency: { type: "string", enum: ["weekly", "monthly", "quarterly", "annually"], description: "Service frequency - standardized format" },
                        first_generation_date: { type: "string", description: "First service date in YYYY-MM-DD format" },
                        location: {
                          type: "object",
                          properties: {
                            existingLocationId: { type: "string", description: "ID if location matches existing location by name and address" },
                            name: { type: "string", description: "Location name - preferably suburb/city name" },
                            address: { type: "string", description: "Full street address" },
                            city: { type: "string", description: "City/suburb name" },
                            state: { type: "string", description: "State/province code" },
                            postcode: { type: "string", description: "Postal/zip code if available" }
                          },
                          required: ["name", "address"]
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
