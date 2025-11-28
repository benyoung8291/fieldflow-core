import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { document_type, document_id, template_id } = await req.json();

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('pdf_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError) throw templateError;

    // Fetch document data based on type
    let documentData: any = {};
    
    switch (document_type) {
      case 'quote':
        const { data: quote } = await supabase
          .from('quotes')
          .select(`
            *,
            customer:customers(*),
            location:customer_locations(*),
            contact:contacts(*)
          `)
          .eq('id', document_id)
          .single();
        
        const { data: quoteLineItems } = await supabase
          .from('quote_line_items')
          .select('*')
          .eq('quote_id', document_id)
          .order('item_order');
        
        documentData = {
          ...quote,
          line_items: quoteLineItems || []
        };
        break;

      case 'field_report':
        const { data: report } = await supabase
          .from('field_reports')
          .select(`
            *,
            customer:customers(*),
            location:customer_locations(*),
            photos:field_report_photos(*)
          `)
          .eq('id', document_id)
          .single();
        
        documentData = report;
        break;

      // Add other document types as needed
    }

    // Generate HTML from template JSON
    const html = generateHTMLFromTemplate(template.template_json, documentData);

    // Wrap in complete HTML document with print styles
    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: ${template.page_settings.size || 'A4'};
              margin: ${template.page_settings.margins?.top || 20}mm 
                      ${template.page_settings.margins?.right || 20}mm 
                      ${template.page_settings.margins?.bottom || 20}mm 
                      ${template.page_settings.margins?.left || 20}mm;
            }
            @media print {
              body { margin: 0; }
              .page-break { page-break-before: always; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 8px;
              border: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    return new Response(
      fullHTML,
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/html'
        } 
      }
    );
  } catch (error: any) {
    console.error('Error rendering PDF template:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateHTMLFromTemplate(templateJson: any, data: any): string {
  // Parse Craft.js template JSON and convert to HTML
  // Replace placeholders like {{customer.name}} with actual data
  
  // This is a simplified version - you'll need to implement proper JSON to HTML conversion
  let html = '<div>';
  
  // For now, return a basic structure
  // TODO: Implement full Craft.js JSON to HTML conversion
  html += `<h1>${data.quote_number || data.report_number || 'Document'}</h1>`;
  html += `<p>Customer: ${data.customer?.name || 'N/A'}</p>`;
  
  if (data.line_items) {
    html += '<table><thead><tr><th>Description</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>';
    data.line_items.forEach((item: any) => {
      html += `<tr>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>$${item.unit_price}</td>
        <td>$${item.line_total}</td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div>';
  return html;
}