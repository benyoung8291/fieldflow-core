import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId } = await req.json();

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: "contractId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get contract and attachment details
    const { data: contract, error: contractError } = await supabase
      .from("project_contracts")
      .select("*, project_attachments(*)")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: "Contract not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("project_contracts")
      .update({ extraction_status: "processing" })
      .eq("id", contractId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are a contract data extraction specialist. Extract key information from building/construction contract documents.
Extract and return the following information in a structured format:
- Contract number
- Contract value/amount (numeric)
- Start date (YYYY-MM-DD format)
- End date/completion date (YYYY-MM-DD format)
- Payment terms (text description)
- Retention percentage (numeric, default 0 if not mentioned)
- Whether variations are allowed (boolean)
- Builder/contractor name
- Builder ABN (Australian Business Number)
- Builder contact information (phone/email)

If any field cannot be found, return null for that field. Be precise and extract exact values.`;

    const userPrompt = `Extract contract data from this document: ${contract.project_attachments?.file_name || 'contract document'}

File type: ${contract.project_attachments?.file_type || 'unknown'}

Please analyze and extract all relevant contract information.`;

    // Call Lovable AI with tool calling for structured output
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
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_contract_data",
            description: "Extract structured contract data from the document",
            parameters: {
              type: "object",
              properties: {
                contract_number: { type: "string" },
                contract_value: { type: "number" },
                start_date: { type: "string", format: "date" },
                end_date: { type: "string", format: "date" },
                payment_terms: { type: "string" },
                retention_percentage: { type: "number" },
                variations_allowed: { type: "boolean" },
                builder_name: { type: "string" },
                builder_abn: { type: "string" },
                builder_contact: { type: "string" }
              },
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_contract_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      await supabase
        .from("project_contracts")
        .update({ 
          extraction_status: "failed",
          extraction_error: `AI extraction failed: ${response.status}`
        })
        .eq("id", contractId);

      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    // Update contract with extracted data
    const { error: updateError } = await supabase
      .from("project_contracts")
      .update({
        contract_number: extractedData.contract_number || null,
        contract_value: extractedData.contract_value || null,
        start_date: extractedData.start_date || null,
        end_date: extractedData.end_date || null,
        payment_terms: extractedData.payment_terms || null,
        retention_percentage: extractedData.retention_percentage || 0,
        variations_allowed: extractedData.variations_allowed ?? true,
        builder_name: extractedData.builder_name || null,
        builder_abn: extractedData.builder_abn || null,
        builder_contact: extractedData.builder_contact || null,
        extracted_data: extractedData,
        extraction_status: "completed",
        extraction_error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", contractId);

    if (updateError) {
      console.error("Error updating contract:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-contract-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});