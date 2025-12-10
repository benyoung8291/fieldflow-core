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

// Generate report number
async function generateReportNumber(supabase: any, tenantId: string): Promise<string> {
  const { count } = await supabase
    .from('field_reports')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  const sequence = (count || 0) + 1;
  return `FR-${String(sequence).padStart(5, '0')}-C`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      token,
      phone,
      contactId,
      contactType,
      customerName,
      locationName,
      manualLocationEntry,
      contractorName,
      reportData,
    } = await req.json();

    if (!token || !phone || !contractorName) {
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
    const isVerified = !!(contactId && contactType && customerName && locationName);

    let customerId: string | null = null;
    let locationId: string | null = null;
    let verifiedContactId: string | null = null;
    let submissionType: string;
    let status: string;
    let needsCustomerMapping: boolean;

    if (isVerified) {
      // Verified submission - resolve IDs server-side
      submissionType = 'verified_contractor';
      status = 'contractor_submitted';
      needsCustomerMapping = false;

      // Verify phone ownership
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
          phoneValid = (!!contactPhoneNorm && contactPhoneNorm === normalizedPhone) || 
                       (!!contactMobileNorm && contactMobileNorm === normalizedPhone);
          if (phoneValid) verifiedContactId = contact.id;
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
          phoneValid = (!!profilePhoneNorm && profilePhoneNorm === normalizedPhone) || 
                       (!!workerPhoneNorm && workerPhoneNorm === normalizedPhone);
        }
      }

      if (!phoneValid) {
        return new Response(
          JSON.stringify({ error: 'phone_mismatch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolve customer by name
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', link.tenant_id)
        .eq('name', customerName)
        .eq('is_active', true)
        .single();

      if (!customer) {
        return new Response(
          JSON.stringify({ error: 'customer_not_found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customerId = customer.id;

      // Resolve location by name
      const { data: location } = await supabase
        .from('customer_locations')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('name', locationName)
        .eq('is_active', true)
        .is('archived', false)
        .single();

      if (!location) {
        return new Response(
          JSON.stringify({ error: 'location_not_found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      locationId = location.id;
    } else {
      // Unverified submission
      if (!manualLocationEntry) {
        return new Response(
          JSON.stringify({ error: 'manual_location_required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      submissionType = 'unverified_contractor';
      status = 'pending_mapping';
      needsCustomerMapping = true;
    }

    // Generate report number
    const reportNumber = await generateReportNumber(supabase, link.tenant_id);

    // Create the field report
    const { data: report, error: reportError } = await supabase
      .from('field_reports')
      .insert({
        tenant_id: link.tenant_id,
        report_number: reportNumber,
        customer_id: customerId,
        location_id: locationId,
        status,
        submission_type: submissionType,
        contractor_phone: normalizedPhone,
        contractor_name: contractorName,
        manual_location_entry: manualLocationEntry || null,
        needs_customer_mapping: needsCustomerMapping,
        verified_contact_id: verifiedContactId,
        service_date: reportData?.reportDate || new Date().toISOString().split('T')[0],
        arrival_time: reportData?.arrivalTime || null,
        work_description: reportData?.workDescription || null,
        internal_notes: reportData?.internalNotes || null,
        carpet_condition_rating: reportData?.carpetConditionRating || null,
        hardfloor_condition_rating: reportData?.hardfloorConditionRating || null,
        flooring_state_description: reportData?.flooringState || null,
        swms_completed: reportData?.swmsCompleted || false,
        test_tag_completed: reportData?.testTagCompleted || false,
        equipment_good_order: reportData?.equipmentGoodOrder || false,
        had_problem_areas: reportData?.problemAreas || false,
        problem_areas_description: reportData?.problemAreasDescription || null,
        methods_attempted: reportData?.methodsAttempted || null,
        had_incident: reportData?.incident || false,
        incident_description: reportData?.incidentDescription || null,
        customer_signature_data: reportData?.signatureData || null,
        customer_signature_name: reportData?.signatureName || null,
        customer_signature_date: reportData?.signatureData ? new Date().toISOString() : null,
      })
      .select('id, report_number')
      .single();

    if (reportError) {
      console.error('Error creating field report:', reportError);
      return new Response(
        JSON.stringify({ error: 'server_error', details: reportError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Field report created:', report.id, report.report_number);

    // Create photo records if photos were provided
    if (reportData?.photos && Array.isArray(reportData.photos) && reportData.photos.length > 0) {
      const photoInserts = reportData.photos.map((photo: any) => ({
        tenant_id: link.tenant_id,
        field_report_id: report.id,
        file_url: photo.fileUrl,
        file_name: photo.fileName,
        file_type: 'image/jpeg',
        photo_type: photo.type,
        notes: photo.notes || null,
        display_order: photo.displayOrder,
        // uploaded_by is null for anonymous contractor uploads
      }));

      const { data: insertedPhotos, error: photosError } = await supabase
        .from('field_report_photos')
        .insert(photoInserts)
        .select('id, file_url, photo_type, display_order');

      if (photosError) {
        console.error('Error creating photo records:', photosError);
        // Don't fail the whole request, just log the error
      } else if (insertedPhotos) {
        // Update paired_photo_id for paired photos
        for (const photo of reportData.photos) {
          if (photo.type === 'after' && photo.pairedWithIndex !== null) {
            const beforePhoto = insertedPhotos.find(
              (p: any) => p.photo_type === 'before' && p.display_order === photo.pairedWithIndex
            );
            const afterPhoto = insertedPhotos.find(
              (p: any) => p.file_url === photo.fileUrl && p.photo_type === 'after'
            );

            if (beforePhoto && afterPhoto) {
              await Promise.all([
                supabase
                  .from('field_report_photos')
                  .update({ paired_photo_id: afterPhoto.id })
                  .eq('id', beforePhoto.id),
                supabase
                  .from('field_report_photos')
                  .update({ paired_photo_id: beforePhoto.id })
                  .eq('id', afterPhoto.id)
              ]);
            }
          }
        }
        console.log('Created', insertedPhotos.length, 'photo records');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportId: report.id,
        reportNumber: report.report_number,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error submitting contractor field report:', error);
    return new Response(
      JSON.stringify({ error: 'server_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
