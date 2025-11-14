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

    console.log(`Parsing email content for ${extractionType}`);

    // Step 1: Classify the email if extractionType is not specified
    let detectedType = extractionType;
    let confidence = 1.0;

    if (!extractionType || extractionType === 'auto') {
      const classificationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Analyze the email and determine its primary type. Return ONLY a JSON object with:
- type: one of ["invoice", "purchase_order", "service_order", "contact", "lead", "general"]
- confidence: number between 0 and 1
- reasoning: brief explanation`
            },
            {
              role: "user",
              content: `Classify this email:\n\n${emailContent}`
            }
          ],
        }),
      });

      if (classificationResponse.ok) {
        const classificationData = await classificationResponse.json();
        const classificationText = classificationData.choices?.[0]?.message?.content || '{}';
        const cleanedText = classificationText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
          const classification = JSON.parse(cleanedText);
          detectedType = classification.type || 'general';
          confidence = classification.confidence || 0.5;
          console.log('Email classified as:', detectedType, 'with confidence:', confidence);
        } catch (e) {
          console.error('Failed to parse classification:', cleanedText);
          detectedType = 'general';
        }
      }
    }

    // Step 2: Extract data based on detected type using structured output
    const extractionSchemas: Record<string, any> = {
      invoice: {
        type: "function",
        function: {
          name: "extract_invoice_data",
          description: "Extract invoice information from email",
          parameters: {
            type: "object",
            properties: {
              vendor_name: { type: "string", description: "Supplier/vendor name" },
              invoice_number: { type: "string", description: "Invoice number or ID" },
              invoice_date: { type: "string", description: "Invoice date in ISO format (YYYY-MM-DD)" },
              due_date: { type: "string", description: "Payment due date in ISO format" },
              total_amount: { type: "number", description: "Total invoice amount" },
              tax_amount: { type: "number", description: "Tax amount" },
              description: { type: "string", description: "Brief description of invoice" },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                    amount: { type: "number" }
                  }
                }
              }
            },
            required: ["vendor_name"]
          }
        }
      },
      purchase_order: {
        type: "function",
        function: {
          name: "extract_po_data",
          description: "Extract purchase order information",
          parameters: {
            type: "object",
            properties: {
              vendor_name: { type: "string", description: "Supplier name" },
              description: { type: "string", description: "What is being ordered" },
              expected_delivery_date: { type: "string", description: "Expected delivery date in ISO format" },
              total_amount: { type: "number", description: "Total order amount if mentioned" },
              notes: { type: "string", description: "Additional notes or special instructions" },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" }
                  }
                }
              }
            },
            required: ["vendor_name", "description"]
          }
        }
      },
      service_order: {
        type: "function",
        function: {
          name: "extract_service_data",
          description: "Extract service order information",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Brief title of service needed" },
              description: { type: "string", description: "Detailed description of service request" },
              priority: { type: "string", enum: ["low", "medium", "high"], description: "Service priority" },
              requested_date: { type: "string", description: "Requested service date in ISO format" },
              location: { type: "string", description: "Service location address" },
              contact_name: { type: "string", description: "Contact person name" },
              contact_email: { type: "string", description: "Contact email" },
              contact_phone: { type: "string", description: "Contact phone number" },
              issue_category: { type: "string", description: "Type of issue (e.g., maintenance, repair, installation)" }
            },
            required: ["title", "description"]
          }
        }
      },
      contact: {
        type: "function",
        function: {
          name: "extract_contact_data",
          description: "Extract contact information",
          parameters: {
            type: "object",
            properties: {
              first_name: { type: "string", description: "First name" },
              last_name: { type: "string", description: "Last name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              company: { type: "string", description: "Company name" },
              position: { type: "string", description: "Job title or position" },
              notes: { type: "string", description: "Additional notes about the contact" }
            },
            required: ["email"]
          }
        }
      },
      lead: {
        type: "function",
        function: {
          name: "extract_lead_data",
          description: "Extract sales lead information",
          parameters: {
            type: "object",
            properties: {
              company_name: { type: "string", description: "Company name" },
              contact_name: { type: "string", description: "Contact person name" },
              email: { type: "string", description: "Email address" },
              phone: { type: "string", description: "Phone number" },
              source: { type: "string", description: "Lead source", default: "Email" },
              description: { type: "string", description: "Description of opportunity or inquiry" },
              estimated_value: { type: "number", description: "Estimated deal value if mentioned" },
              status: { type: "string", default: "new" },
              interest_area: { type: "string", description: "Product/service they're interested in" }
            },
            required: ["company_name", "description"]
          }
        }
      }
    };

    const schema = extractionSchemas[detectedType];
    
    if (!schema) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Unknown email type detected" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a data extraction expert. Extract all relevant information from the email content. If a field is not mentioned or cannot be determined, omit it from the response. Be precise and accurate.`
          },
          {
            role: "user",
            content: `Extract information from this email:\n\n${emailContent}`
          }
        ],
        tools: [schema],
        tool_choice: { type: "function", function: { name: schema.function.name } }
      }),
    });

    if (!extractionResponse.ok) {
      if (extractionResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (extractionResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await extractionResponse.text();
      console.error("AI gateway error:", extractionResponse.status, errorText);
      throw new Error("Failed to extract email content");
    }

    const extractionData = await extractionResponse.json();
    const toolCall = extractionData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No structured data extracted from email");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    
    console.log("Successfully extracted email content:", parsedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
        detected_type: detectedType,
        confidence: confidence
      }),
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
