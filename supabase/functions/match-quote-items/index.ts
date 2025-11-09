import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lineItemsText, tenantId } = await req.json();
    
    if (!lineItemsText || !tenantId) {
      throw new Error('Missing required fields');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pricebook items and assemblies
    const { data: priceBookItems } = await supabase
      .from('price_book_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const { data: assemblies } = await supabase
      .from('price_book_assemblies')
      .select(`
        *,
        price_book_assembly_items (
          *,
          price_book_item:price_book_items (*)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // Fetch recent quotes for context
    const { data: recentQuotes } = await supabase
      .from('quotes')
      .select(`
        id,
        title,
        quote_line_items (
          description,
          quantity,
          cost_price,
          margin_percentage,
          sell_price
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    const systemPrompt = `You are an AI assistant helping to match uploaded line items to a company's pricebook and historical quotes.

PRICEBOOK ITEMS:
${JSON.stringify(priceBookItems || [], null, 2)}

ASSEMBLIES:
${JSON.stringify(assemblies || [], null, 2)}

RECENT QUOTE HISTORY:
${JSON.stringify(recentQuotes || [], null, 2)}

Your task is to:
1. Parse the uploaded line items text
2. Match each line item to the most appropriate pricebook item or assembly
3. Suggest quantities, pricing, and margins based on historical data
4. Return a structured JSON array of matched items

Return format:
{
  "items": [
    {
      "description": "matched description",
      "quantity": number,
      "cost_price": number,
      "margin_percentage": number,
      "sell_price": number,
      "confidence": "high" | "medium" | "low",
      "matched_from": "pricebook" | "assembly" | "history" | "new",
      "price_book_item_id": "uuid or null",
      "notes": "explanation of the match"
    }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Parse and match these line items:\n\n${lineItemsText}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to extract JSON from the response
    let matchedItems;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        matchedItems = JSON.parse(jsonMatch[0]);
      } else {
        matchedItems = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Failed to parse AI response');
    }

    return new Response(JSON.stringify(matchedItems), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in match-quote-items:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
