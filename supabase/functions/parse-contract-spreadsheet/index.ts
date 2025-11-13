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
    
    // For analysis, only need a few rows. For parsing, limit to 100.
    const limitedSpreadsheetData = processingMode === "analyze" 
      ? spreadsheetData.slice(0, 5) 
      : spreadsheetData.slice(0, 100);
    
    // Use Lovable AI with structured output to parse the spreadsheet
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: processingMode === "analyze" ? [
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
        ] : [
          {
            role: "system",
            content: `You are an expert at parsing service contract spreadsheets using provided column mappings. Extract line items according to the specified column mappings.

EXTRACTION RULES:
- Use ONLY the column names provided in the mappings
- Convert prices to numbers (remove $, commas)
- Standardize frequency to: weekly, monthly, quarterly, annually
- Convert dates to YYYY-MM-DD format (use 2025 if year not specified)
- Default quantity to 1 if mapping is null
- Match existing locations by name and address`
          },
          {
            role: "user",
            content: `Parse this spreadsheet using these column mappings:
${JSON.stringify(columnMappings, null, 2)}

Data to parse (${limitedSpreadsheetData.length} rows):
${JSON.stringify(limitedSpreadsheetData.slice(0, 3), null, 2)}
... and ${limitedSpreadsheetData.length - 3} more rows

Existing locations for matching:
${JSON.stringify(locations || [], null, 2)}

Extract all line items using the provided mappings.`
          }
        ],
        tools: processingMode === "analyze" ? [
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
        ] : [
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
        tool_choice: processingMode === "analyze" 
          ? { type: "function", function: { name: "suggest_column_mappings" } }
          : { type: "function", function: { name: "parse_line_items" } }
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
    
    if (processingMode === "analyze") {
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
    } else {
      console.log("Parsed line items:", JSON.stringify(parsedData, null, 2));
      
      // Enrich location data with geocoding from Google Maps API
      const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
      const failedGeocodingItems: number[] = [];
      
      if (GOOGLE_PLACES_API_KEY) {
        console.log("Enriching locations with Google Maps geocoding...");
        
        // Create a map to store unique addresses to avoid duplicate API calls
        const geocodedAddresses = new Map();
        
        for (let i = 0; i < parsedData.lineItems.length; i++) {
          const item = parsedData.lineItems[i];
          const addressKey = `${item.location.address}, ${item.location.city || ''}, ${item.location.state || ''}, ${item.location.postcode || ''}`.trim();
          
          // Skip if already geocoded
          if (geocodedAddresses.has(addressKey)) {
            const cachedData = geocodedAddresses.get(addressKey);
            item.location.latitude = cachedData.latitude;
            item.location.longitude = cachedData.longitude;
            item.location.formatted_address = cachedData.formatted_address;
            item.location.geocoding_status = cachedData.geocoding_status;
            if (cachedData.geocoding_status === 'failed') {
              failedGeocodingItems.push(i);
            }
            continue;
          }
          
          try {
            // Call Google Geocoding API with retry logic
            let geocodeSuccess = false;
            let retryCount = 0;
            const maxRetries = 2;
            
            while (!geocodeSuccess && retryCount <= maxRetries) {
              try {
                const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
                geocodeUrl.searchParams.append("address", addressKey);
                geocodeUrl.searchParams.append("components", "country:AU");
                geocodeUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);
                
                const geocodeResponse = await fetch(geocodeUrl.toString());
                const geocodeData = await geocodeResponse.json();
                
                if (geocodeData.status === "OK" && geocodeData.results && geocodeData.results.length > 0) {
                  const result = geocodeData.results[0];
                  const location = result.geometry.location;
                  
                  const enrichedData = {
                    latitude: location.lat,
                    longitude: location.lng,
                    formatted_address: result.formatted_address,
                    geocoding_status: 'success'
                  };
                  
                  // Cache and apply to item
                  geocodedAddresses.set(addressKey, enrichedData);
                  item.location.latitude = enrichedData.latitude;
                  item.location.longitude = enrichedData.longitude;
                  item.location.formatted_address = enrichedData.formatted_address;
                  item.location.geocoding_status = 'success';
                  
                  // Also update the address field with the validated address if it looks better
                  if (result.formatted_address && result.formatted_address.length > 0) {
                    item.location.address = result.formatted_address.split(',')[0].trim();
                  }
                  
                  console.log(`Geocoded: ${addressKey} -> lat: ${location.lat}, lng: ${location.lng}`);
                  geocodeSuccess = true;
                } else {
                  console.warn(`Geocoding attempt ${retryCount + 1} failed for: ${addressKey} - Status: ${geocodeData.status}`);
                  retryCount++;
                  
                  if (retryCount <= maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  }
                }
              } catch (fetchError) {
                console.error(`Geocoding fetch error (attempt ${retryCount + 1}):`, fetchError);
                retryCount++;
                
                if (retryCount <= maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }
            }
            
            // If all retries failed, mark as failed
            if (!geocodeSuccess) {
              const failedData = {
                latitude: null,
                longitude: null,
                formatted_address: null,
                geocoding_status: 'failed'
              };
              geocodedAddresses.set(addressKey, failedData);
              item.location.geocoding_status = 'failed';
              failedGeocodingItems.push(i);
              console.error(`Failed to geocode after ${maxRetries + 1} attempts: ${addressKey}`);
            }
          } catch (geocodeError) {
            console.error(`Error geocoding address ${addressKey}:`, geocodeError);
            item.location.geocoding_status = 'failed';
            failedGeocodingItems.push(i);
          }
        }
        
        console.log(`Successfully geocoded ${geocodedAddresses.size - failedGeocodingItems.length} unique addresses`);
        console.log(`Failed to geocode ${failedGeocodingItems.length} addresses`);
      } else {
        console.warn("Google Places API key not configured - skipping geocoding");
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: "parse",
          lineItems: parsedData.lineItems,
          failedGeocodingItems,
          tenantId
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
