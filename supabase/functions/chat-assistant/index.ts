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
    const { message, conversationHistory, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Received message:', message);
    console.log('Conversation history length:', conversationHistory?.length || 0);
    console.log('Context:', context);

    // Fetch context data from database
    let contextData = '';
    if (context && context.documentId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      try {
        // Fetch document data based on module
        if (context.module === 'quotes' && context.documentId) {
          const { data: quote } = await supabaseClient
            .from('quotes')
            .select('*, customers(name), contacts(first_name, last_name, email)')
            .eq('id', context.documentId)
            .single();
          
          if (quote) {
            contextData += `\n\n**Current Document:** Quote ${quote.quote_number}\n`;
            contextData += `Customer: ${quote.customers?.name || 'N/A'}\n`;
            contextData += `Status: ${quote.status}\n`;
            contextData += `Total: $${quote.total_amount}\n`;
            contextData += `Contact: ${quote.contacts?.first_name} ${quote.contacts?.last_name}\n`;
          }
        } else if (context.module === 'service-orders' && context.documentId) {
          const { data: order } = await supabaseClient
            .from('service_orders')
            .select('*, customers(name), customer_locations(name, address)')
            .eq('id', context.documentId)
            .single();
          
          if (order) {
            contextData += `\n\n**Current Document:** Service Order ${order.order_number}\n`;
            contextData += `Customer: ${order.customers?.name || 'N/A'}\n`;
            contextData += `Location: ${order.customer_locations?.name || 'N/A'}\n`;
            contextData += `Status: ${order.status}\n`;
            contextData += `Title: ${order.title}\n`;
          }
        } else if (context.module === 'projects' && context.documentId) {
          const { data: project } = await supabaseClient
            .from('projects')
            .select('*, customers(name)')
            .eq('id', context.documentId)
            .single();
          
          if (project) {
            contextData += `\n\n**Current Document:** Project ${project.project_number}\n`;
            contextData += `Customer: ${project.customers?.name || 'N/A'}\n`;
            contextData += `Title: ${project.title}\n`;
            contextData += `Status: ${project.status}\n`;
            contextData += `Budget: $${project.original_budget}\n`;
          }
        } else if (context.module === 'invoices' && context.documentId) {
          const { data: invoice } = await supabaseClient
            .from('invoices')
            .select('*, customers(name)')
            .eq('id', context.documentId)
            .single();
          
          if (invoice) {
            contextData += `\n\n**Current Document:** Invoice ${invoice.invoice_number}\n`;
            contextData += `Customer: ${invoice.customers?.name || 'N/A'}\n`;
            contextData += `Type: ${invoice.invoice_type}\n`;
            contextData += `Status: ${invoice.status}\n`;
            contextData += `Total: $${invoice.total_amount}\n`;
          }
        } else if (context.module === 'customers' && context.documentId) {
          const { data: customer } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('id', context.documentId)
            .single();
          
          if (customer) {
            contextData += `\n\n**Current Document:** Customer ${customer.name}\n`;
            contextData += `Type: ${customer.customer_type}\n`;
            contextData += `Email: ${customer.email || 'N/A'}\n`;
            contextData += `Phone: ${customer.phone || 'N/A'}\n`;
          }
        }
      } catch (dbError) {
        console.error('Error fetching context data:', dbError);
      }
    }

    const messages = [
      {
        role: "system",
        content: `You are PerrAI, a helpful AI assistant for the Service Pulse application. Service Pulse is a comprehensive business management system for service-based companies.

Your role is to help users:
- Understand what they're looking at on their current page
- Navigate through their tasks and documents efficiently
- Get quick context about related documents and entities
- Complete their work faster with helpful suggestions
- Answer questions using the database context provided

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

**Current Context:**
- Page: ${context?.currentPage || 'Dashboard'}
- Module: ${context?.module || 'Dashboard'}
${contextData}

Be concise, friendly, and actionable. Use the context data provided to give specific, relevant answers. When referencing the current document, use specific details from the context. If users ask about related documents or need additional information, explain what you can see and offer to help them navigate.`
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
