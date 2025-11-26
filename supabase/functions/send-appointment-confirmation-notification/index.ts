import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { appointmentId, workerIds, appointmentTitle, startTime, endTime } = await req.json();

    // Format the notification message
    const startDate = new Date(startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = `${startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })} - ${new Date(endTime).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })}`;

    // Create notifications for each worker
    const notifications = await Promise.all(
      workerIds.map(async (workerId: string) => {
        const { data, error } = await supabaseClient
          .from('notifications')
          .insert({
            user_id: workerId,
            type: 'appointment_confirmation',
            title: 'Confirm Your Appointment',
            message: `Please confirm your assignment for "${appointmentTitle}" on ${formattedDate} at ${formattedTime}`,
            link: `/worker/appointments/${appointmentId}`,
            metadata: {
              appointmentId,
              requiresConfirmation: true,
            },
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating notification:', error);
          throw error;
        }

        return data;
      })
    );

    console.log(`Created ${notifications.length} notifications for appointment ${appointmentId}`);

    return new Response(
      JSON.stringify({ success: true, notificationCount: notifications.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-appointment-confirmation-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
