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
    const { spreadsheetData, customerId, mode, columnMappings } = await req.json();
    
    if (!spreadsheetData || !Array.isArray(spreadsheetData) || spreadsheetData.length === 0) {
      throw new Error("Invalid spreadsheet data");
    }

    if (!customerId) {
      throw new Error("Customer ID is required");
    }

    // Mode: "analyze" for column mapping, "parse" for full parsing
    const processingMode = mode || "parse";

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

    console.log(`Sending to AI for ${processingMode}...`);
    
    // Helper function to process a batch of rows
    const processBatch = async (batchData: any[], batchNumber: number, totalBatches: number) => {
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchData.length - 1} rows)`);
      
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
              content: `You are an expert at parsing service contract spreadsheets using provided column mappings. Extract line items according to the specified column mappings.

CRITICAL EXTRACTION RULES:
- You MUST extract ALL rows from the data (skip only the header row at index 0)
- Use ONLY the column names provided in the mappings to find data
- For each row, extract the value from the column specified in the mapping
- Convert prices to numbers (remove $, commas)
- Standardize frequency to: weekly, monthly, quarterly, annually (map "6 Monthly" to "quarterly", "Annual" to "annually", etc.)
- Convert dates to YYYY-MM-DD format (use 2025 if year not specified, convert month names like "Jul" to "2025-07-01", "Jan" to "2025-01-01", etc.)
- Default quantity to 1 if mapping is null or value is not a valid number
- Match existing locations by name and address when possible

YOU MUST RETURN ALL DATA ROWS AS LINE ITEMS.`
            },
            {
              role: "user",
              content: `Parse this spreadsheet batch using these column mappings:
${JSON.stringify(columnMappings, null, 2)}

Data to parse (${batchData.length} rows including header):
${JSON.stringify(batchData, null, 2)}

Existing locations for matching:
${JSON.stringify(locations || [], null, 2)}

IMPORTANT: 
- Row 0 is the header row with column names
- Rows 1 onwards contain the actual data you must extract
- For each data row (rows 1-${batchData.length - 1}), create a line item
- Use the column mappings to know which column index to extract from
- You MUST return ${batchData.length - 1} line items (one for each data row)

Extract ALL line items using the provided mappings.`
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
                          quantity: { type: "number", description: "Service quantity - MUST be 1 if field is missing, null, empty, or not a valid number" },
                          unit_price: { type: "number", description: "Price per service as number (no currency symbols)" },
                          estimated_hours: { type: "number", description: "Estimated hours for this service (default 0 if not specified)" },
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
                              postcode: { type: "string", description: "Postal/zip code if available" },
                              customer_location_id: { type: "string", description: "Customer's external location ID/reference if provided" }
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
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (aiResponse.status === 402) {
          throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
        }
        const errorText = await aiResponse.text();
        console.error(`AI gateway error for batch ${batchNumber}:`, aiResponse.status, errorText);
        throw new Error(`AI parsing failed for batch ${batchNumber}`);
      }

      const result = await aiResponse.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error(`No structured output from AI for batch ${batchNumber}`);
      }

      return JSON.parse(toolCall.function.arguments);
    };
    
    // Clean and validate spreadsheet data
    const cleanSpreadsheetData = (data: any[]): any[] => {
      return data.map((row, rowIndex) => {
        if (rowIndex === 0) return row; // Keep headers unchanged
        
        return row.map((cell: any) => {
          if (cell === null || cell === undefined) return '';
          
          let cleanedCell = String(cell).trim();
          
          // Handle Excel error values
          if (cleanedCell.startsWith('#')) {
            console.warn(`Excel error detected in row ${rowIndex + 1}: ${cleanedCell}`);
            return '0'; // Default error cells to 0 for numeric fields
          }
          
          // Clean currency values: remove $, commas, extra spaces
          if (cleanedCell.match(/^\$?[\d,]+\.?\d*\s*$/)) {
            cleanedCell = cleanedCell.replace(/[\$,\s]/g, '');
          }
          
          return cleanedCell;
        });
      });
    };
    
    const cleanedData = cleanSpreadsheetData(spreadsheetData);
    
    // For analysis, only need a few rows. For parsing, limit to 1,000.
    const limitedSpreadsheetData = processingMode === "analyze" 
      ? cleanedData.slice(0, 5) 
      : cleanedData.slice(0, 1001); // +1 for header
    
    const hasMoreRows = spreadsheetData.length > 1001;
    const BATCH_SIZE = 50; // Process 50 rows per AI request for better performance
    
    // Validate data quality
    const dataIssues: string[] = [];
    cleanedData.forEach((row, index) => {
      if (index === 0) return; // Skip header
      row.forEach((cell: any) => {
        if (String(cell).startsWith('#')) {
          dataIssues.push(`Row ${index + 1} contains Excel error`);
        }
      });
    });
    
    if (dataIssues.length > 0) {
      console.warn(`Data quality issues detected: ${dataIssues.length} issues found`);
    }
    
    // Handle parse mode with batching
    if (processingMode === "parse") {
      const header = limitedSpreadsheetData[0];
      const dataRows = limitedSpreadsheetData.slice(1);
      
      // Split into batches
      const batches: any[][] = [];
      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batchRows = dataRows.slice(i, i + BATCH_SIZE);
        batches.push([header, ...batchRows]); // Include header in each batch
      }
      
      console.log(`Processing ${dataRows.length} rows in ${batches.length} batches of ${BATCH_SIZE}`);
      
      // Process batches in parallel
      const batchPromises = batches.map((batch, index) => 
        processBatch(batch, index + 1, batches.length)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Combine all line items from all batches
      const allLineItems = batchResults.flatMap(result => result.lineItems);
      
      console.log(`Parsed ${allLineItems.length} total line items from ${batches.length} batches`);
      
      // Normalize quantity values: ensure all quantities are valid numbers, default to 1 if invalid
      for (const item of allLineItems) {
        if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
          console.log(`Normalizing invalid quantity for item "${item.description}": ${item.quantity} -> 1`);
          item.quantity = 1;
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: "parse",
          lineItems: allLineItems,
          tenantId,
          hasMoreRows,
          totalRows: spreadsheetData.length,
          processedRows: limitedSpreadsheetData.length - 1, // Exclude header
          batchesProcessed: batches.length,
          dataIssues: dataIssues.length > 0 ? dataIssues.slice(0, 10) : [] // Return first 10 issues
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Handle analyze mode with single AI call
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
            content: `You are an expert at analyzing spreadsheet structures for service contracts. Examine the column headers and sample data to identify which columns contain which information.

Your task is to suggest column mappings for:
- description: Service description or address field
- location_name: Suburb, city, or location name field
- location_address: Street address field
- location_city: City/suburb field
- location_state: State/province field
- location_postcode: Postal/zip code field
- customer_location_id: Customer's external location ID/reference field
- unit_price: Price per service field (with $, cost, amount, rate, etc.)
- quantity: Quantity field (if not found, null)
- estimated_hours: Estimated hours field (hours, time, duration, etc. - if not found, null)
- frequency: Service frequency field (monthly, quarterly, etc.)
- start_date: First service date or month field

Return the exact column name from the spreadsheet for each field. If a field cannot be found, return null for that mapping.`
          },
          {
            role: "user",
            content: `Analyze this spreadsheet structure and suggest column mappings:

Headers and sample data:
${JSON.stringify(limitedSpreadsheetData, null, 2)}

Identify which column corresponds to each required field.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_column_mappings",
              description: "Suggest which columns map to which fields",
              parameters: {
                type: "object",
                properties: {
                  mappings: {
                    type: "object",
                    properties: {
                      description: { type: "string", description: "Column name for service description", nullable: true },
                      location_name: { type: "string", description: "Column name for location/suburb name", nullable: true },
                      location_address: { type: "string", description: "Column name for street address", nullable: true },
                      location_city: { type: "string", description: "Column name for city", nullable: true },
                      location_state: { type: "string", description: "Column name for state", nullable: true },
                      location_postcode: { type: "string", description: "Column name for postcode", nullable: true },
                      customer_location_id: { type: "string", description: "Column name for customer location ID/reference", nullable: true },
                      unit_price: { type: "string", description: "Column name for price per service", nullable: true },
                      quantity: { type: "string", description: "Column name for quantity", nullable: true },
                      estimated_hours: { type: "string", description: "Column name for estimated hours", nullable: true },
                      frequency: { type: "string", description: "Column name for service frequency", nullable: true },
                      start_date: { type: "string", description: "Column name for start date/first service", nullable: true }
                    }
                  },
                  availableColumns: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of all column names found in spreadsheet"
                  }
                },
                required: ["mappings", "availableColumns"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_column_mappings" } }
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
    
    // Return analyze results
    console.log("Suggested mappings:", JSON.stringify(parsedData, null, 2));
    return new Response(
      JSON.stringify({
        success: true,
        mode: "analyze",
        mappings: parsedData.mappings,
        availableColumns: parsedData.availableColumns,
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
