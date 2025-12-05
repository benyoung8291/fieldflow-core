import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate PIN before returning any data
    const { pin } = await req.json();
    const correctPin = Deno.env.get('TV_DASHBOARD_PIN');
    
    if (!correctPin) {
      console.error('TV_DASHBOARD_PIN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (pin !== correctPin) {
      console.warn('Invalid PIN attempt for TV availability data');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    
    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 59);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const todayStr = formatDate(today);
    const endDateStr = formatDate(endDate);

    console.log(`Fetching TV availability data from ${todayStr} to ${endDateStr}`);

    // Fetch all data in parallel
    const [
      workersResult,
      schedulesResult,
      unavailabilityResult,
      seasonalResult,
      seasonalDatesResult,
      appointmentsResult
    ] = await Promise.all([
      // Active workers
      supabase
        .from("profiles")
        .select("id, first_name, last_name, worker_state, is_active")
        .eq("is_active", true)
        .order("first_name"),
      
      // Worker schedules
      supabase
        .from("worker_schedule")
        .select("worker_id, day_of_week, start_time, end_time, is_active")
        .eq("is_active", true),
      
      // Unavailability
      supabase
        .from("worker_unavailability")
        .select("worker_id, start_date, end_date, reason, notes")
        .lte("start_date", endDateStr)
        .gte("end_date", todayStr),
      
      // Seasonal availability
      supabase
        .from("worker_seasonal_availability")
        .select("id, worker_id, start_date, end_date")
        .lte("start_date", endDateStr)
        .gte("end_date", todayStr),
      
      // Seasonal dates
      supabase
        .from("worker_seasonal_availability_dates")
        .select("id, seasonal_availability_id, date, periods, worker_seasonal_availability!inner(worker_id)")
        .gte("date", todayStr)
        .lte("date", endDateStr),
      
      // Appointments with workers
      supabase
        .from("appointments")
        .select("id, start_time, end_time, appointment_workers(worker_id)")
        .gte("start_time", today.toISOString())
        .lte("start_time", endDate.toISOString())
    ]);

    // Check for errors
    if (workersResult.error) {
      console.error("Error fetching workers:", workersResult.error);
      throw workersResult.error;
    }
    if (schedulesResult.error) {
      console.error("Error fetching schedules:", schedulesResult.error);
      throw schedulesResult.error;
    }
    if (unavailabilityResult.error) {
      console.error("Error fetching unavailability:", unavailabilityResult.error);
      throw unavailabilityResult.error;
    }
    if (seasonalResult.error) {
      console.error("Error fetching seasonal availability:", seasonalResult.error);
      throw seasonalResult.error;
    }
    if (seasonalDatesResult.error) {
      console.error("Error fetching seasonal dates:", seasonalDatesResult.error);
      throw seasonalDatesResult.error;
    }
    if (appointmentsResult.error) {
      console.error("Error fetching appointments:", appointmentsResult.error);
      throw appointmentsResult.error;
    }

    // Process seasonal dates to include worker_id
    const seasonalDates = (seasonalDatesResult.data || []).map((d: any) => ({
      id: d.id,
      seasonal_availability_id: d.seasonal_availability_id,
      date: d.date,
      periods: d.periods || [],
      worker_id: d.worker_seasonal_availability?.worker_id,
    }));

    // Process appointments to include worker_ids array
    const appointments = (appointmentsResult.data || []).map((apt: any) => ({
      id: apt.id,
      start_time: apt.start_time,
      end_time: apt.end_time,
      worker_ids: (apt.appointment_workers || []).map((aw: any) => aw.worker_id),
    }));

    console.log(`Found ${workersResult.data?.length || 0} workers, ${schedulesResult.data?.length || 0} schedules, ${appointments.length} appointments`);

    return new Response(
      JSON.stringify({
        workers: workersResult.data || [],
        schedules: schedulesResult.data || [],
        unavailability: unavailabilityResult.data || [],
        seasonalPeriods: seasonalResult.data || [],
        seasonalDates,
        appointments,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching TV availability data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
