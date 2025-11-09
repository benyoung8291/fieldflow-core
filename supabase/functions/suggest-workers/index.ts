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
    const { serviceOrderId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch service order details
    const { data: serviceOrder, error: serviceOrderError } = await supabase
      .from("service_orders")
      .select(`
        *,
        customers!service_orders_customer_id_fkey(address, city, state),
        customer_locations!service_orders_customer_location_id_fkey(address, latitude, longitude)
      `)
      .eq("id", serviceOrderId)
      .maybeSingle();

    if (serviceOrderError) {
      console.error("Error fetching service order:", serviceOrderError);
      throw new Error(`Failed to fetch service order: ${serviceOrderError.message}`);
    }

    if (!serviceOrder) {
      throw new Error("Service order not found");
    }

    // Try to fetch required skills if the table exists
    const { data: requiredSkills } = await supabase
      .from("service_order_required_skills")
      .select(`
        required_level,
        skills(id, name, category)
      `)
      .eq("service_order_id", serviceOrderId);

    const preferredDate = serviceOrder.preferred_date || new Date().toISOString().split('T')[0];
    const dateRangeEnd = serviceOrder.date_range_end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all active workers with their skills
    const { data: workers } = await supabase
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        preferred_start_time,
        preferred_end_time,
        preferred_days,
        worker_skills(
          skill_level,
          skills(id, name, category)
        )
      `)
      .eq("is_active", true)
      .not("first_name", "is", null);

    if (!workers || workers.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For each worker, fetch their appointments in the date range
    const workersWithAppointments = await Promise.all(
      workers.map(async (worker) => {
        const { data: appointments } = await supabase
          .from("appointments")
          .select("start_time, end_time, location_address")
          .eq("assigned_to", worker.id)
          .gte("start_time", new Date(preferredDate).toISOString())
          .lte("start_time", new Date(new Date(dateRangeEnd).setDate(new Date(dateRangeEnd).getDate() + 1)).toISOString())
          .order("start_time");

        const { data: availability } = await supabase
          .from("worker_availability")
          .select("*")
          .eq("worker_id", worker.id);

        return {
          ...worker,
          appointments: appointments || [],
          availability: availability || []
        };
      })
    );

    // Prepare context for AI
    const systemPrompt = `You are a worker recommendation assistant. Analyze workers' skills, availability, and schedules to suggest the best workers for a service order.

CRITICAL SCORING CRITERIA (in order of importance):
1. SKILLS MATCH (50% of score): Worker MUST have all required skills at or above required level
   - Missing any required skill: maximum 40% score
   - Lower skill level than required: deduct 10% per skill
2. AVAILABILITY (30% of score): Worker should be available during preferred date range
   - Fully booked on preferred date: deduct 20%
   - No availability pattern set: deduct 10%
3. SCHEDULE OPTIMIZATION (20% of score): Minimize travel time and conflicts
   - Back-to-back appointments: deduct 5%
   - Matches preferred days/hours: add 5%

Provide 3-5 worker suggestions ranked by overall suitability score (0-100).`;

    const requiredSkillsText = requiredSkills?.map((req: any) => 
      `- ${req.skills?.name} (${req.skills?.category}) - Level Required: ${req.required_level}`
    ).join('\n') || "No specific skills required";

    const workersAnalysis = workersWithAppointments.map(worker => {
      const workerSkillsText = worker.worker_skills?.map((skill: any) =>
        `  - ${skill.skills?.name} (${skill.skills?.category}) - Level: ${skill.skill_level}`
      ).join('\n') || "  No skills recorded";

      const appointmentsText = worker.appointments.map((apt: any) =>
        `  - ${new Date(apt.start_time).toLocaleString()} to ${new Date(apt.end_time).toLocaleString()}`
      ).join('\n') || "  No appointments";

      const availabilityText = worker.availability.map((avail: any) =>
        `  - ${avail.day_of_week}: ${avail.start_time} to ${avail.end_time} (${avail.is_available ? 'Available' : 'Unavailable'})`
      ).join('\n') || "  No availability pattern set";

      return `
Worker: ${worker.first_name} ${worker.last_name} (ID: ${worker.id})
Skills:
${workerSkillsText}
Appointments (${preferredDate} to ${dateRangeEnd}):
${appointmentsText}
Availability Pattern:
${availabilityText}
Preferences:
  - Start: ${worker.preferred_start_time || "Not set"}
  - End: ${worker.preferred_end_time || "Not set"}
  - Days: ${worker.preferred_days?.join(', ') || "Not set"}
`;
    }).join('\n---\n');

    const userPrompt = `Service Order: ${serviceOrder.title || "Untitled"}
Order Number: ${serviceOrder.order_number}
Location: ${serviceOrder.customer_locations?.[0]?.address || serviceOrder.customers?.address || "Unknown"}
Estimated Duration: ${serviceOrder.estimated_hours || 2} hours
Preferred Date: ${preferredDate}
Date Range: ${preferredDate} to ${dateRangeEnd}

REQUIRED SKILLS:
${requiredSkillsText}

AVAILABLE WORKERS:
${workersAnalysis}

Analyze and rank workers by suitability. Heavily penalize workers missing required skills.`;

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
              name: "suggest_workers",
              description: "Return 3-5 worker recommendations ranked by suitability",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        worker_id: {
                          type: "string",
                          description: "Worker's profile ID"
                        },
                        worker_name: {
                          type: "string",
                          description: "Worker's full name"
                        },
                        score: {
                          type: "number",
                          description: "Suitability score from 0-100"
                        },
                        skills_match: {
                          type: "boolean",
                          description: "Whether worker has all required skills at sufficient levels"
                        },
                        reasoning: {
                          type: "string",
                          description: "Brief explanation of ranking including skills assessment"
                        },
                        suggested_date: {
                          type: "string",
                          description: "ISO date string for optimal scheduling"
                        },
                        availability_notes: {
                          type: "string",
                          description: "Notes about worker's availability in the date range"
                        }
                      },
                      required: ["worker_id", "worker_name", "score", "skills_match", "reasoning"],
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
        tool_choice: { type: "function", function: { name: "suggest_workers" } }
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
    console.error("Error in suggest-workers:", error);
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
