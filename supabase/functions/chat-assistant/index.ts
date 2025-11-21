import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Received message:', message);
    console.log('Conversation history length:', conversationHistory?.length || 0);

    const messages = [
      {
        role: "system",
        content: `You are PerrAI, a helpful AI assistant for the Service Pulse application. Service Pulse is a comprehensive business management system for service-based companies.

Your role is to help users:
- Understand what they're looking at on their current page
- Navigate through their tasks and documents efficiently
- Get quick context about related documents and entities
- Complete their work faster with helpful suggestions

Key features of Service Pulse include:
- CRM with leads, contacts, and customers
- Quotes and quote pipeline management
- Service orders and appointments
- Projects with Gantt charts and task management
- Invoicing (AR and AP)
- Purchase orders
- Service contracts with auto-generation
- Expense management
- Helpdesk/ticketing system

Be concise, friendly, and actionable. Focus on helping users accomplish their immediate goals. If asked about specific data, let them know you can see their context but would need them to share details.`
      },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    console.log('Calling AI Gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ response: "I'm currently experiencing high demand. Please try again in a moment." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AI Gateway response received');
    
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error('No content in AI response:', data);
      throw new Error('No content in AI response');
    }

    return new Response(
      JSON.stringify({ response: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in chat-assistant:', error);
    return new Response(
      JSON.stringify({ 
        response: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
