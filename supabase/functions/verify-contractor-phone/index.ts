import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory rate limiting (resets on function restart)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);

  if (!limit || now > limit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }

  if (limit.count >= 5) {
    return false;
  }

  limit.count++;
  return true;
}

// Normalize phone number to a consistent format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Handle Australian formats
  if (normalized.startsWith('+61')) {
    // Already in international format, keep as is
    return normalized;
  } else if (normalized.startsWith('61') && normalized.length >= 11) {
    // 61400000000 -> +61400000000
    return '+' + normalized;
  } else if (normalized.startsWith('0') && normalized.length === 10) {
    // 0400000000 -> +61400000000
    return '+61' + normalized.substring(1);
  } else if (normalized.length === 9 && !normalized.startsWith('0')) {
    // 400000000 -> +61400000000
    return '+61' + normalized;
  }

  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('cf-connecting-ip') ||
               'unknown';

    if (!checkRateLimit(ip)) {
      console.log('Rate limited IP:', ip);
      return new Response(
        JSON.stringify({ verified: false, reason: 'rate_limited' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token, phone } = await req.json();

    if (!token || !phone) {
      return new Response(
        JSON.stringify({ verified: false, reason: 'missing_params' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the token first
    const { data: link, error: linkError } = await supabase
      .from('contractor_field_report_links')
      .select('id, tenant_id, is_active, expires_at')
      .eq('token', token)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ verified: false, reason: 'invalid_token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!link.is_active || (link.expires_at && new Date(link.expires_at) < new Date())) {
      return new Response(
        JSON.stringify({ verified: false, reason: 'link_expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    console.log('Normalized phone:', normalizedPhone, 'from:', phone);

    // Search for matching supplier contact
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, mobile, supplier_id, suppliers:supplier_id(id, name)')
      .eq('tenant_id', link.tenant_id)
      .not('supplier_id', 'is', null);

    let matchedContact = null;
    if (!contactError && contacts && normalizedPhone) {
      for (const contact of contacts) {
        const contactPhoneNorm = contact.phone ? normalizePhoneNumber(contact.phone) : '';
        const contactMobileNorm = contact.mobile ? normalizePhoneNumber(contact.mobile) : '';
        
        // Only match if contact has a phone and it matches the normalized input
        if ((contactPhoneNorm && contactPhoneNorm === normalizedPhone) || 
            (contactMobileNorm && contactMobileNorm === normalizedPhone)) {
          matchedContact = contact;
          break;
        }
      }
    }

    if (matchedContact) {
      console.log('Matched supplier contact:', matchedContact.id);
      
      // Get suggested customers from appointment history
      const { data: appointments } = await supabase
        .from('appointment_workers')
        .select(`
          appointment:appointment_id (
            service_order:service_order_id (
              customer:customer_id (
                id,
                name
              ),
              location:location_id (
                id,
                name,
                customer_id
              )
            )
          )
        `)
        .eq('contact_id', matchedContact.id)
        .eq('tenant_id', link.tenant_id);

      // Extract unique customers from appointment history
      const suggestedCustomers = new Map<string, { name: string; locations: string[] }>();
      
      if (appointments) {
        for (const aw of appointments) {
          const appt = aw.appointment as any;
          if (appt?.service_order?.customer) {
            const customer = appt.service_order.customer;
            const location = appt.service_order.location;
            
            if (!suggestedCustomers.has(customer.id)) {
              suggestedCustomers.set(customer.id, { name: customer.name, locations: [] });
            }
            
            if (location && !suggestedCustomers.get(customer.id)!.locations.includes(location.name)) {
              suggestedCustomers.get(customer.id)!.locations.push(location.name);
            }
          }
        }
      }

      const supplierData = Array.isArray(matchedContact.suppliers) ? matchedContact.suppliers[0] : matchedContact.suppliers;

      return new Response(
        JSON.stringify({
          verified: true,
          contactType: 'supplier_contact',
          contactId: matchedContact.id,
          contactName: `${matchedContact.first_name} ${matchedContact.last_name}`,
          supplierName: supplierData?.name,
          tenantId: link.tenant_id,
          suggestedCustomers: Array.from(suggestedCustomers.values()),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search for matching worker/profile
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, worker_phone')
      .eq('tenant_id', link.tenant_id);

    let matchedWorker = null;
    if (!profileError && profiles && normalizedPhone) {
      for (const profile of profiles) {
        const profilePhoneNorm = profile.phone ? normalizePhoneNumber(profile.phone) : '';
        const workerPhoneNorm = profile.worker_phone ? normalizePhoneNumber(profile.worker_phone) : '';
        
        // Only match if profile has a phone and it matches the normalized input
        if ((profilePhoneNorm && profilePhoneNorm === normalizedPhone) || 
            (workerPhoneNorm && workerPhoneNorm === normalizedPhone)) {
          matchedWorker = profile;
          break;
        }
      }
    }

    if (matchedWorker) {
      console.log('Matched worker:', matchedWorker.id);
      
      // Get suggested customers from appointment history for workers
      const { data: appointments } = await supabase
        .from('appointment_workers')
        .select(`
          appointment:appointment_id (
            service_order:service_order_id (
              customer:customer_id (
                id,
                name
              ),
              location:location_id (
                id,
                name,
                customer_id
              )
            )
          )
        `)
        .eq('worker_id', matchedWorker.id)
        .eq('tenant_id', link.tenant_id);

      const suggestedCustomers = new Map<string, { name: string; locations: string[] }>();
      
      if (appointments) {
        for (const aw of appointments) {
          const appt = aw.appointment as any;
          if (appt?.service_order?.customer) {
            const customer = appt.service_order.customer;
            const location = appt.service_order.location;
            
            if (!suggestedCustomers.has(customer.id)) {
              suggestedCustomers.set(customer.id, { name: customer.name, locations: [] });
            }
            
            if (location && !suggestedCustomers.get(customer.id)!.locations.includes(location.name)) {
              suggestedCustomers.get(customer.id)!.locations.push(location.name);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          verified: true,
          contactType: 'worker',
          contactId: matchedWorker.id,
          contactName: `${matchedWorker.first_name} ${matchedWorker.last_name}`,
          tenantId: link.tenant_id,
          suggestedCustomers: Array.from(suggestedCustomers.values()),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No match found
    console.log('No match found for phone:', normalizedPhone);
    return new Response(
      JSON.stringify({ verified: false, tenantId: link.tenant_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying contractor phone:', error);
    return new Response(
      JSON.stringify({ verified: false, reason: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
