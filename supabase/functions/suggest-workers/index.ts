import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeError, sanitizeDatabaseError } from '../_shared/errorHandler.ts';

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
      return new Response(
        JSON.stringify({ error: sanitizeError(new Error('Configuration error'), 'suggest-workers') }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        customer_locations:customer_location_id(address, latitude, longitude)
      `)
      .eq("id", serviceOrderId)
      .maybeSingle();

    if (serviceOrderError) {
      console.error("Error fetching service order:", serviceOrderError);
      return new Response(
        JSON.stringify({ error: sanitizeDatabaseError(serviceOrderError, 'suggest-workers') }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!serviceOrder) {
      return new Response(
        JSON.stringify({ error: sanitizeDatabaseError(new Error('Not found'), 'suggest-workers') }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

        const { data: schedule } = await supabase
          .from("worker_schedule")
          .select("*")
          .eq("worker_id", worker.id)
          .eq("is_active", true);

        const { data: unavailability } = await supabase
          .from("worker_unavailability")
          .select("*")
          .eq("worker_id", worker.id)
          .gte("end_date", preferredDate)
          .lte("start_date", dateRangeEnd);

        return {
          ...worker,
          appointments: appointments || [],
          schedule: schedule || [],
          unavailability: unavailability || []
        };
      })
    );

    console.log("Workers with appointments:", JSON.stringify(workersWithAppointments, null, 2));
    console.log("Service Order:", JSON.stringify(serviceOrder, null, 2));
    console.log("Required Skills:", JSON.stringify(requiredSkills, null, 2));

    // Prepare context for AI
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const preferredDateObj = new Date(preferredDate);
    const dayOfWeek = DAYS[preferredDateObj.getDay()];
    
    const systemPrompt = `You are a worker recommendation assistant. Analyze workers' skills, availability, and schedules to suggest the best workers for a service order.

UNDERSTANDING THE DATA:
- Regular Weekly Schedule: Shows which days each worker normally works and their hours (e.g., "Monday: 09:00:00 to 17:00:00" means they work 9am-5pm on Mondays)
- Times with "00:00:00 to 23:59:00" mean the worker is available ANYTIME that day
- If a day is missing from the schedule, the worker does NOT work that day
- Unavailable Periods: Specific dates when worker is NOT available (vacation, training, etc.)
- Appointments: Already scheduled work for the worker

CRITICAL SCORING CRITERIA (in order of importance):
1. SKILLS MATCH (50% of score): Worker MUST have all required skills at or above required level
   - Missing any required skill: maximum 40% score
   - Lower skill level than required: deduct 10% per skill
2. REGULAR SCHEDULE MATCH (25% of score): Check if worker's regular schedule includes the service order day
   - Worker doesn't work on that day of week: deduct 25% (major issue!)
   - Working hours don't cover the service time: deduct 10%
3. AVAILABILITY (15% of score): Worker should NOT have unavailability periods during preferred date
   - Has unavailability during preferred date: deduct 15%
4. SCHEDULE OPTIMIZATION (10% of score): Minimize conflicts with existing appointments
   - Back-to-back appointments: deduct 5%

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

      const scheduleText = worker.schedule.length > 0 
        ? worker.schedule.map((sched: any) => {
            const isAnytime = (sched.start_time === "00:00:00" || sched.start_time === "00:00") && 
                             (sched.end_time === "23:59:00" || sched.end_time === "23:59");
            return `  - ${DAYS[sched.day_of_week]}: ${isAnytime ? 'Anytime (Available all day)' : `${sched.start_time} to ${sched.end_time}`}`;
          }).join('\n')
        : "  ⚠️ NO REGULAR SCHEDULE SET - Worker has not specified working days/hours";

      const unavailabilityText = worker.unavailability.length > 0
        ? worker.unavailability.map((unavail: any) =>
            `  - ${unavail.start_date} to ${unavail.end_date}${unavail.start_time ? ` (${unavail.start_time}-${unavail.end_time})` : ' (All day)'}: ${unavail.reason || 'No reason'}`
          ).join('\n')
        : "  No unavailable periods";

      return `
Worker: ${worker.first_name} ${worker.last_name} (ID: ${worker.id})
Skills:
${workerSkillsText}
Regular Weekly Schedule:
${scheduleText}
Appointments (${preferredDate} to ${dateRangeEnd}):
${appointmentsText}
Unavailable Periods:
${unavailabilityText}
`;
    }).join('\n---\n');

    const userPrompt = `Service Order: ${serviceOrder.title || "Untitled"}
Order Number: ${serviceOrder.order_number}
Location: ${serviceOrder.customer_locations?.[0]?.address || serviceOrder.customers?.address || "Unknown"}
Estimated Duration: ${serviceOrder.estimated_hours || 2} hours
Preferred Date: ${preferredDate} (${dayOfWeek})
Date Range: ${preferredDate} to ${dateRangeEnd}

IMPORTANT: The service needs to be performed on ${dayOfWeek}. Only recommend workers who have ${dayOfWeek} in their regular schedule!

REQUIRED SKILLS:
${requiredSkillsText}

AVAILABLE WORKERS:
${workersAnalysis}

Analyze and rank workers by suitability. CRITICAL: Workers must work on ${dayOfWeek} to be suitable!`;

    console.log("User prompt being sent to AI:", userPrompt);

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
      return new Response(
        JSON.stringify({ error: sanitizeError(new Error('AI processing failed'), 'suggest-workers') }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: sanitizeError(new Error('No suggestions'), 'suggest-workers') }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    
    console.log("AI Suggestions:", JSON.stringify(suggestions, null, 2));

    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: sanitizeError(error, 'suggest-workers') }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
