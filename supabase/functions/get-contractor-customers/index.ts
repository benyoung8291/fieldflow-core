import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize phone number to a consistent format
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[^\d+]/g, '');

  if (normalized.startsWith('+61')) {
    return normalized;
  } else if (normalized.startsWith('61') && normalized.length >= 11) {
    return '+' + normalized;
  } else if (normalized.startsWith('0') && normalized.length === 10) {
    return '+61' + normalized.substring(1);
  } else if (normalized.length === 9 && !normalized.startsWith('0')) {
    return '+61' + normalized;
  }

  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, phone, contactId, contactType } = await req.json();

    if (!token || !phone || !contactId || !contactType) {
      return new Response(
        JSON.stringify({ error: 'missing_params' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the token
    const { data: link, error: linkError } = await supabase
      .from('contractor_field_report_links')
      .select('id, tenant_id, is_active, expires_at')
      .eq('token', token)
      .single();

    if (linkError || !link || !link.is_active || (link.expires_at && new Date(link.expires_at) < new Date())) {
      return new Response(
        JSON.stringify({ error: 'invalid_token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // Re-verify phone ownership
    let phoneValid = false;
    if (contactType === 'supplier_contact') {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, phone, mobile')
        .eq('id', contactId)
        .eq('tenant_id', link.tenant_id)
        .single();

      if (contact) {
        const contactPhoneNorm = contact.phone ? normalizePhoneNumber(contact.phone) : '';
        const contactMobileNorm = contact.mobile ? normalizePhoneNumber(contact.mobile) : '';
        phoneValid = contactPhoneNorm === normalizedPhone || contactMobileNorm === normalizedPhone;
      }
    } else if (contactType === 'worker') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, phone, worker_phone')
        .eq('id', contactId)
        .eq('tenant_id', link.tenant_id)
        .single();

      if (profile) {
        const profilePhoneNorm = profile.phone ? normalizePhoneNumber(profile.phone) : '';
        const workerPhoneNorm = profile.worker_phone ? normalizePhoneNumber(profile.worker_phone) : '';
        phoneValid = profilePhoneNorm === normalizedPhone || workerPhoneNorm === normalizedPhone;
      }
    }

    if (!phoneValid) {
      return new Response(
        JSON.stringify({ error: 'phone_mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get suggested customers from appointment history
    const suggestedCustomerIds = new Set<string>();
    const appointmentQuery = contactType === 'supplier_contact'
      ? { contact_id: contactId }
      : { worker_id: contactId };

    const { data: appointments } = await supabase
      .from('appointment_workers')
      .select(`
        appointment:appointment_id (
          service_order:service_order_id (
            customer_id
          )
        )
      `)
      .match(appointmentQuery)
      .eq('tenant_id', link.tenant_id);

    if (appointments) {
      for (const aw of appointments) {
        const appt = aw.appointment as any;
        if (appt?.service_order?.customer_id) {
          suggestedCustomerIds.add(appt.service_order.customer_id);
        }
      }
    }

    // Get hidden customers for this contact
    const hiddenCustomerIds = new Set<string>();
    const visibilityQuery = contactType === 'supplier_contact'
      ? { contact_id: contactId }
      : { worker_id: contactId };

    const { data: hiddenCustomers } = await supabase
      .from('contractor_customer_visibility')
      .select('customer_id')
      .match(visibilityQuery)
      .eq('tenant_id', link.tenant_id)
      .eq('is_hidden', true);

    if (hiddenCustomers) {
      for (const hc of hiddenCustomers) {
        hiddenCustomerIds.add(hc.customer_id);
      }
    }

    // Get all active customers for the tenant
    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('tenant_id', link.tenant_id)
      .eq('is_active', true)
      .order('name');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return new Response(
        JSON.stringify({ error: 'server_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Split into suggested and all (excluding hidden)
    const suggested: { name: string }[] = [];
    const all: { name: string }[] = [];

    for (const customer of allCustomers || []) {
      if (hiddenCustomerIds.has(customer.id)) {
        continue; // Skip hidden customers
      }

      if (suggestedCustomerIds.has(customer.id)) {
        suggested.push({ name: customer.name });
      } else {
        all.push({ name: customer.name });
      }
    }

    return new Response(
      JSON.stringify({ suggested, all }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting contractor customers:', error);
    return new Response(
      JSON.stringify({ error: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
