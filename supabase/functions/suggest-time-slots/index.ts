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
    const { 
      workerId, 
      serviceOrderId, 
      preferredDate, 
      estimatedDuration,
      dateRangeEnd 
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate date range for appointment search
    const startDate = new Date(preferredDate);
    const endDate = dateRangeEnd ? new Date(dateRangeEnd) : new Date(startDate);
    endDate.setDate(endDate.getDate() + 7); // Extend by 7 days for flexibility

    // Fetch worker's existing appointments
    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("start_time, end_time, location_address, latitude, longitude")
      .eq("assigned_to", workerId)
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString())
      .order("start_time");

    // Fetch worker availability
    const { data: availability } = await supabase
      .from("worker_availability")
      .select("*")
      .eq("worker_id", workerId);

    // Fetch worker profile for preferred hours
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_start_time, preferred_end_time, preferred_days")
      .eq("id", workerId)
      .single();

    // Fetch worker skills
    const { data: workerSkills } = await supabase
      .from("worker_skills")
      .select(`
        skill_level,
        skills(name, category)
      `)
      .eq("worker_id", workerId);

    // Fetch service order details and required skills
    const { data: serviceOrder } = await supabase
      .from("service_orders")
      .select(`
        *,
        customers!service_orders_customer_id_fkey(
          address,
          city,
          state
        ),
        customer_locations(
          address,
          latitude,
          longitude
        ),
        service_order_required_skills(
          required_level,
          skills(name, category)
        )
      `)
      .eq("id", serviceOrderId)
      .single();

    // Prepare context for AI
    const systemPrompt = `You are a scheduling optimization assistant. Analyze the worker's schedule, availability, skills, and travel logistics to suggest optimal time slots.

Consider:
1. Worker's existing appointments and buffer time between jobs
2. Worker's preferred working hours and days
3. Travel time between appointments (estimate based on location data)
4. Avoid back-to-back scheduling without travel buffer
5. Prioritize slots that minimize total travel time
6. Respect worker availability patterns
7. CRITICAL: Match worker skills to service order requirements - penalize heavily if skills don't match
8. Preferred date priority - slots on the preferred date score higher, but suggest alternatives if preferred date is suboptimal
9. Consider date range flexibility - if preferred date is fully booked or has poor options, suggest better slots within the date range

Provide 3-5 time slot suggestions ranked by optimality (0-100 score).`;

    const userPrompt = `Service Order: ${serviceOrder?.title || "Untitled"}
Location: ${serviceOrder?.customer_locations?.[0]?.address || serviceOrder?.customers?.address || "Unknown"}
Estimated Duration: ${estimatedDuration || serviceOrder?.estimated_hours || 2} hours
Preferred Date: ${new Date(preferredDate).toLocaleDateString()}
${dateRangeEnd ? `Date Range: ${new Date(preferredDate).toLocaleDateString()} to ${new Date(dateRangeEnd).toLocaleDateString()}` : ""}

SKILLS ANALYSIS (CRITICAL):
Required Skills for Service Order:
${serviceOrder?.service_order_required_skills?.map((req: any) => 
  `- ${req.skills?.name} (${req.skills?.category}) - Level Required: ${req.required_level}`
).join('\n') || "No specific skills required"}

Worker's Skills:
${workerSkills?.map((skill: any) => 
  `- ${skill.skills?.name} (${skill.skills?.category}) - Level: ${skill.skill_level}`
).join('\n') || "No skills recorded"}

${serviceOrder?.service_order_required_skills?.length > 0 ? "⚠️ Significantly reduce score if worker lacks required skills or has insufficient skill levels!" : ""}

Worker's Existing Appointments:
${existingAppointments?.map((apt: any) => 
  `- ${new Date(apt.start_time).toLocaleString()} to ${new Date(apt.end_time).toLocaleString()} at ${apt.location_address || "Unknown location"}`
).join('\n') || "No existing appointments"}

Worker Availability Patterns:
${availability?.map((avail: any) => 
  `- ${avail.day_of_week}: ${avail.start_time} to ${avail.end_time} (Available: ${avail.is_available ? 'Yes' : 'No'})`
).join('\n') || "No specific availability set"}

Worker Preferences:
- Preferred Start: ${profile?.preferred_start_time || "Not set"}
- Preferred End: ${profile?.preferred_end_time || "Not set"}
- Preferred Days: ${profile?.preferred_days?.join(', ') || "Not set"}

Suggest optimal time slots. Prioritize preferred date but suggest alternatives if better options exist in the date range.`;

    // Call Lovable AI with tool calling for structured output
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
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_time_slots",
              description: "Return 3-5 optimal time slot suggestions ranked by quality",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        start_time: {
                          type: "string",
                          description: "ISO 8601 datetime string"
                        },
                        end_time: {
                          type: "string",
                          description: "ISO 8601 datetime string"
                        },
                        score: {
                          type: "number",
                          description: "Optimality score from 0-100"
                        },
                        reasoning: {
                          type: "string",
                          description: "Brief explanation of why this slot is optimal, including skills match assessment"
                        },
                        skills_match: {
                          type: "boolean",
                          description: "Whether worker skills adequately match service order requirements"
                        },
                        travel_time_before: {
                          type: "number",
                          description: "Estimated travel time in minutes from previous appointment"
                        },
                        travel_time_after: {
                          type: "number",
                          description: "Estimated travel time in minutes to next appointment"
                        }
                      },
                      required: ["start_time", "end_time", "score", "reasoning"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suggestions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_time_slots" } }
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
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("AI Gateway request failed");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No suggestions generated");
    }

    const suggestions = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in suggest-time-slots:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
