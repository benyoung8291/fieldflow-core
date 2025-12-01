import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MarkupData {
  type: 'pin' | 'zone';
  x: number;
  y: number;
  bounds?: { x: number; y: number; width: number; height: number };
  notes: string;
  photo?: string;
}

interface RequestBody {
  token: string;
  markups: MarkupData[];
  submitterName?: string;
  submitterEmail?: string;
  requestTitle?: string;
  requestDescription?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: RequestBody = await req.json();
    const { token, markups, submitterName, submitterEmail, requestTitle, requestDescription } = body;

    console.log('Processing shared markup request for token:', token);

    // Validate input
    if (!token || !markups || !Array.isArray(markups) || markups.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate all markups have notes
    const incompleteMarkups = markups.filter(m => !m.notes?.trim());
    if (incompleteMarkups.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'All markups must have descriptions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch and validate share link
    const { data: shareLink, error: linkError } = await supabase
      .from('floor_plan_share_links')
      .select(`
        *,
        floor_plan:floor_plans(id, name),
        location:customer_locations(name),
        tenant:tenants(id),
        customer:customers(id)
      `)
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (linkError || !shareLink) {
      console.error('Share link not found:', linkError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired share link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (new Date(shareLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'This share link has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check submission limit
    if (shareLink.max_submissions && shareLink.usage_count >= shareLink.max_submissions) {
      return new Response(
        JSON.stringify({ success: false, error: 'Maximum submissions reached for this link' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Requests pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from('helpdesk_pipelines')
      .select('id')
      .eq('tenant_id', shareLink.tenant_id)
      .eq('name', 'Requests')
      .single();

    if (pipelineError || !pipeline) {
      console.error('Requests pipeline not found:', pipelineError);
      return new Response(
        JSON.stringify({ success: false, error: 'System configuration error. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create helpdesk ticket
    const ticketSubject = requestTitle || 
      `${shareLink.location.name} - Shared Floor Plan Request`;
    
    const { data: ticket, error: ticketError } = await supabase
      .from('helpdesk_tickets')
      .insert({
        subject: ticketSubject,
        customer_id: shareLink.customer_id,
        tenant_id: shareLink.tenant_id,
        pipeline_id: pipeline.id,
        status: 'new',
        priority: 'medium',
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created ticket:', ticket.id);

    // Create initial message if provided
    let messageContent = requestDescription || '';
    if (submitterName || submitterEmail) {
      const submitterInfo = [
        submitterName ? `Name: ${submitterName}` : '',
        submitterEmail ? `Email: ${submitterEmail}` : ''
      ].filter(Boolean).join('\n');
      
      messageContent = submitterInfo + (messageContent ? `\n\n${messageContent}` : '');
    }

    if (messageContent) {
      await supabase
        .from('helpdesk_messages')
        .insert({
          ticket_id: ticket.id,
          tenant_id: shareLink.tenant_id,
          body: messageContent,
          message_type: 'note',
          is_internal: false,
          is_from_customer: true,
        });
    }

    // Create markup records
    const markupInserts = markups.map((markup) => {
      const baseMarkup = {
        ticket_id: ticket.id,
        floor_plan_id: shareLink.floor_plan_id,
        tenant_id: shareLink.tenant_id,
        markup_data: {
          type: markup.type,
          notes: markup.notes,
          photo_url: markup.photo,
        },
      };

      if (markup.type === 'pin') {
        return {
          ...baseMarkup,
          pin_x: markup.x,
          pin_y: markup.y,
        };
      } else {
        const centerX = markup.bounds!.x + markup.bounds!.width / 2;
        const centerY = markup.bounds!.y + markup.bounds!.height / 2;
        return {
          ...baseMarkup,
          pin_x: centerX,
          pin_y: centerY,
          markup_data: {
            ...baseMarkup.markup_data,
            bounds: markup.bounds,
          },
        };
      }
    });

    const { error: markupError } = await supabase
      .from('ticket_markups')
      .insert(markupInserts);

    if (markupError) {
      console.error('Error creating markups:', markupError);
      // Don't fail the request, ticket was created successfully
    }

    // Update usage count and last_used_at
    await supabase
      .from('floor_plan_share_links')
      .update({
        usage_count: shareLink.usage_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', shareLink.id);

    console.log('Successfully processed shared markup request');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Request submitted successfully',
        ticketNumber: ticket.ticket_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing shared markup request:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
