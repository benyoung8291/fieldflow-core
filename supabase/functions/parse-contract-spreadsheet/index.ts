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
    const { spreadsheetData } = await req.json();
    
    if (!spreadsheetData || !Array.isArray(spreadsheetData) || spreadsheetData.length === 0) {
      throw new Error("Invalid spreadsheet data");
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

    // Fetch a limited sample of existing customers and locations for reference
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, abn, email")
      .eq("tenant_id", tenantId)
      .limit(50);

    const { data: locations } = await supabase
      .from("customer_locations")
      .select("id, name, customer_id, address, city, state, postcode")
      .eq("tenant_id", tenantId)
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
            content: `You are an expert at parsing service contract spreadsheets. Extract service contract information including customer details, contract terms, location information, and line items. Match existing customers and locations when possible.`
          },
          {
            role: "user",
            content: `Parse this spreadsheet data into service contracts. Match customers by name/ABN/email and locations by address when found in the reference lists.

Spreadsheet rows: ${limitedSpreadsheetData.length}
Sample customers available: ${customers?.length || 0}
Sample locations available: ${locations?.length || 0}

Extract all contracts with line items and locations.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_contracts",
              description: "Extract service contract data from spreadsheet",
              parameters: {
                type: "object",
                properties: {
                  contracts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        customer: {
                          type: "object",
                          properties: {
                            existingCustomerId: { type: "string", description: "ID if customer exists" },
                            name: { type: "string" },
                            email: { type: "string" },
                            abn: { type: "string" }
                          },
                          required: ["name"]
                        },
                        location: {
                          type: "object",
                          properties: {
                            existingLocationId: { type: "string", description: "ID if location exists" },
                            name: { type: "string" },
                            address: { type: "string" },
                            city: { type: "string" },
                            state: { type: "string" },
                            postcode: { type: "string" }
                          },
                          required: ["name", "address"]
                        },
                        contract: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            contract_type: { type: "string", enum: ["recurring", "one_time"] },
                            start_date: { type: "string", description: "ISO date" },
                            end_date: { type: "string", description: "ISO date" },
                            billing_frequency: { type: "string", enum: ["monthly", "quarterly", "annually"] },
                            service_frequency: { type: "string", enum: ["weekly", "monthly", "quarterly", "annually"] },
                            total_amount: { type: "number" },
                            auto_renew: { type: "boolean" }
                          },
                          required: ["title", "contract_type", "start_date", "billing_frequency"]
                        },
                        lineItems: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              description: { type: "string" },
                              quantity: { type: "number" },
                              unit_price: { type: "number" },
                              frequency: { type: "string" }
                            },
                            required: ["description", "quantity", "unit_price"]
                          }
                        }
                      },
                      required: ["customer", "location", "contract", "lineItems"]
                    }
                  }
                },
                required: ["contracts"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_contracts" } }
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

    const parsedContracts = JSON.parse(toolCall.function.arguments);
    console.log("Parsed contracts:", JSON.stringify(parsedContracts, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        contracts: parsedContracts.contracts,
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
