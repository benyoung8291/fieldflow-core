import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { report_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch report with all related data
    const { data: report, error: reportError } = await supabaseClient
      .from('field_reports')
      .select(`
        *,
        customer:customers(name, email),
        location:customer_locations(name, address, city, state, postcode),
        appointment:appointments(title),
        service_order:service_orders(work_order_number),
        photos:field_report_photos(*)
      `)
      .eq('id', report_id)
      .single();

    if (reportError) throw reportError;

    // Generate HTML for PDF
    const html = generateReportHTML(report);

    // Here you would typically use a PDF generation service
    // For now, we'll return the HTML
    // In production, integrate with a service like Puppeteer or similar

    return new Response(
      JSON.stringify({ html, report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating field report PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateReportHTML(report: any): string {
  const beforePhotos = report.photos?.filter((p: any) => p.photo_type === 'before') || [];
  const afterPhotos = report.photos?.filter((p: any) => p.photo_type === 'after') || [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Field Report - ${report.report_number}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      border-bottom: 2px solid #ccc;
      padding-bottom: 5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .info-item {
      padding: 10px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
    }
    .info-value {
      margin-top: 5px;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 15px;
    }
    .photo-pair {
      page-break-inside: avoid;
    }
    .photo-container {
      text-align: center;
    }
    .photo-label {
      font-weight: bold;
      margin-bottom: 5px;
      padding: 5px;
      border-radius: 3px;
    }
    .before-label {
      background: #ef4444;
      color: white;
    }
    .after-label {
      background: #10b981;
      color: white;
    }
    .photo-container img {
      width: 100%;
      height: 300px;
      object-fit: cover;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .safety-checks {
      display: grid;
      gap: 10px;
    }
    .check-item {
      padding: 8px;
      background: #f5f5f5;
      border-radius: 5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .check-icon {
      font-weight: bold;
      font-size: 18px;
    }
    .check-pass { color: #10b981; }
    .check-fail { color: #ef4444; }
    .signature {
      margin-top: 20px;
      text-align: center;
    }
    .signature img {
      border: 1px solid #ddd;
      padding: 10px;
      background: white;
      max-height: 150px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Field Report</h1>
    <h2>${report.report_number}</h2>
    <p>${new Date(report.service_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div class="section">
    <div class="section-title">Service Information</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Customer</div>
        <div class="info-value">${report.customer?.name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Location</div>
        <div class="info-value">${report.location?.address || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Worker</div>
        <div class="info-value">${report.worker_name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Time of Attendance</div>
        <div class="info-value">${report.arrival_time}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Condition on Arrival</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Carpet Condition</div>
        <div class="info-value">${report.carpet_condition_arrival || 'N/A'} / 5</div>
      </div>
      <div class="info-item">
        <div class="info-label">Hard Floor Condition</div>
        <div class="info-value">${report.hard_floor_condition_arrival || 'N/A'} / 5</div>
      </div>
    </div>
    ${report.flooring_state_description ? `
    <div class="info-item" style="margin-top: 15px;">
      <div class="info-label">Overall State Description</div>
      <div class="info-value">${report.flooring_state_description}</div>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">Safety Checks</div>
    <div class="safety-checks">
      <div class="check-item">
        <span class="check-icon ${report.has_signed_swms ? 'check-pass' : 'check-fail'}">
          ${report.has_signed_swms ? '✓' : '✗'}
        </span>
        <span>Signed SWMS Available</span>
      </div>
      <div class="check-item">
        <span class="check-icon ${report.equipment_tested_tagged ? 'check-pass' : 'check-fail'}">
          ${report.equipment_tested_tagged ? '✓' : '✗'}
        </span>
        <span>Equipment Tested and Tagged</span>
      </div>
      <div class="check-item">
        <span class="check-icon ${report.equipment_clean_working ? 'check-pass' : 'check-fail'}">
          ${report.equipment_clean_working ? '✓' : '✗'}
        </span>
        <span>Equipment Clean and in Good Working Order</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Work Completed</div>
    <div class="info-item">
      <div class="info-value">${report.work_description}</div>
    </div>
  </div>

  ${beforePhotos.length > 0 ? `
  <div class="section">
    <div class="section-title">Before & After Photos</div>
    <div class="photo-grid">
      ${beforePhotos.map((beforePhoto: any) => {
        const pairedAfter = afterPhotos.find((a: any) => 
          a.id === beforePhoto.paired_photo_id || a.paired_photo_id === beforePhoto.id
        );
        return `
        <div class="photo-pair">
          <div class="photo-container">
            <div class="photo-label before-label">BEFORE</div>
            <img src="${beforePhoto.file_url}" alt="Before" />
          </div>
          ${pairedAfter ? `
          <div class="photo-container" style="margin-top: 10px;">
            <div class="photo-label after-label">AFTER</div>
            <img src="${pairedAfter.file_url}" alt="After" />
          </div>
          ` : ''}
        </div>
        `;
      }).join('')}
    </div>
  </div>
  ` : ''}

  ${report.had_problem_areas ? `
  <div class="section">
    <div class="section-title">Problem Areas</div>
    <div class="info-item">
      <div class="info-label">Description</div>
      <div class="info-value">${report.problem_areas_description || 'N/A'}</div>
    </div>
    ${report.methods_attempted ? `
    <div class="info-item" style="margin-top: 15px;">
      <div class="info-label">Methods Attempted</div>
      <div class="info-value">${report.methods_attempted}</div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  ${report.had_incident ? `
  <div class="section">
    <div class="section-title" style="color: #ef4444;">Incident Report</div>
    <div class="info-item">
      <div class="info-value">${report.incident_description}</div>
    </div>
  </div>
  ` : ''}

  ${report.customer_signature_data ? `
  <div class="section">
    <div class="section-title">Customer Signature</div>
    <div class="signature">
      <img src="${report.customer_signature_data}" alt="Customer Signature" />
      ${report.customer_signature_name ? `
      <p>Signed by: ${report.customer_signature_name}</p>
      ` : ''}
      <p>Date: ${new Date(report.customer_signature_date || report.service_date).toLocaleDateString()}</p>
    </div>
  </div>
  ` : ''}

</body>
</html>
  `;
}