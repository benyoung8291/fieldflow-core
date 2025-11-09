import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteData {
  quote_id: string;
  template_id?: string;
  show_sub_items?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { quote_id, template_id, show_sub_items = true }: QuoteData = await req.json();

    // Fetch quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, customers(*)')
      .eq('id', quote_id)
      .single();

    if (quoteError) throw quoteError;

    // Fetch line items
    const { data: lineItems, error: itemsError } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quote_id', quote_id)
      .order('item_order');

    if (itemsError) throw itemsError;

    // Fetch template if specified
    let template = null;
    if (template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (!templateError) {
        template = templateData;
      }
    }

    // Build hierarchical line items
    const parentItems = lineItems.filter(item => !item.parent_line_item_id);
    const hierarchicalItems = parentItems.map(parent => {
      const subItems = lineItems.filter(item => item.parent_line_item_id === parent.id);
      return { ...parent, subItems };
    });

    // Generate HTML for PDF
    const html = generateQuoteHTML(quote, hierarchicalItems, template, show_sub_items);

    // For now, return HTML (in production, use a PDF library like puppeteer)
    return new Response(
      JSON.stringify({
        success: true,
        html,
        quote_number: quote.quote_number,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function generateQuoteHTML(quote: any, lineItems: any[], template: any, showSubItems: boolean): string {
  const customer = quote.customers;
  const showCostAnalysis = template?.show_cost_analysis || false;
  const showMargins = template?.show_margins || false;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid #0891B2;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #0891B2;
          margin: 0;
        }
        .header p {
          margin: 5px 0;
          color: #666;
        }
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .info-box {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        .info-box h3 {
          margin: 0 0 10px 0;
          color: #0891B2;
          font-size: 14px;
          text-transform: uppercase;
        }
        .info-box p {
          margin: 5px 0;
          font-size: 13px;
        }
        .customer-message {
          background: #f0f9ff;
          padding: 20px;
          border-left: 4px solid #0891B2;
          margin-bottom: 30px;
          white-space: pre-wrap;
          line-height: 1.6;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #0891B2;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
        }
        td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }
        tr:hover {
          background: #f8f9fa;
        }
        .sub-item td {
          padding-left: 40px;
          background: #f9fafb;
          font-size: 11px;
        }
        .totals {
          margin-top: 30px;
          float: right;
          width: 300px;
        }
        .totals table {
          margin-bottom: 0;
        }
        .totals th {
          background: transparent;
          color: #333;
          text-align: right;
        }
        .totals .total-row {
          font-weight: bold;
          font-size: 14px;
        }
        .totals .total-row td {
          border-top: 2px solid #333;
          border-bottom: 3px double #333;
        }
        .terms {
          clear: both;
          margin-top: 40px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        .terms h3 {
          color: #0891B2;
          margin-top: 0;
        }
        .terms p {
          white-space: pre-wrap;
          line-height: 1.6;
          font-size: 12px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #666;
          font-size: 11px;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        .text-right {
          text-align: right;
        }
      </style>
    </head>
    <body>
      ${template?.header_logo_url ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${template.header_logo_url}" alt="Company Logo" style="max-height: 80px;"></div>` : ''}
      
      <div class="header">
        <h1>QUOTATION</h1>
        ${template?.header_text ? `<p>${template.header_text}</p>` : ''}
        <p>Quote #${quote.quote_number}</p>
        <p>Date: ${new Date(quote.created_at).toLocaleDateString()}</p>
        ${quote.valid_until ? `<p>Valid Until: ${new Date(quote.valid_until).toLocaleDateString()}</p>` : ''}
      </div>

      <div class="info-section">
        <div class="info-box">
          <h3>Customer Information</h3>
          <p><strong>${customer.name}</strong></p>
          ${customer.email ? `<p>Email: ${customer.email}</p>` : ''}
          ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
          ${customer.address ? `<p>${customer.address}</p>` : ''}
          ${customer.city || customer.state || customer.postcode ? `<p>${customer.city || ''} ${customer.state || ''} ${customer.postcode || ''}</p>` : ''}
        </div>
        <div class="info-box">
          <h3>Quote Details</h3>
          <p><strong>${quote.title}</strong></p>
          ${quote.description ? `<p>${quote.description}</p>` : ''}
        </div>
      </div>

      ${quote.customer_message ? `<div class="customer-message">${quote.customer_message}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Description</th>
            <th style="width: 10%; text-align: center;">Qty</th>
            ${showCostAnalysis || showMargins ? '<th style="width: 12%; text-align: right;">Cost</th>' : ''}
            ${showMargins ? '<th style="width: 10%; text-align: right;">Margin %</th>' : ''}
            <th style="width: 14%; text-align: right;">Unit Price</th>
            <th style="width: 14%; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  lineItems.forEach(item => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const displayPrice = hasSubItems && showSubItems ? '' : `$${parseFloat(item.sell_price || 0).toFixed(2)}`;
    
    html += `
      <tr>
        <td><strong>${item.description}</strong></td>
        <td style="text-align: center;">${item.quantity}</td>
        ${showCostAnalysis || showMargins ? `<td style="text-align: right;">${!hasSubItems || !showSubItems ? '$' + parseFloat(item.cost_price || 0).toFixed(2) : ''}</td>` : ''}
        ${showMargins ? `<td style="text-align: right;">${!hasSubItems || !showSubItems ? parseFloat(item.margin_percentage || 0).toFixed(1) + '%' : ''}</td>` : ''}
        <td style="text-align: right;">${displayPrice}</td>
        <td style="text-align: right;"><strong>$${parseFloat(item.line_total || 0).toFixed(2)}</strong></td>
      </tr>
    `;

    if (hasSubItems && showSubItems) {
      item.subItems.forEach((sub: any) => {
        html += `
          <tr class="sub-item">
            <td>${sub.description}</td>
            <td style="text-align: center;">${sub.quantity}</td>
            ${showCostAnalysis || showMargins ? `<td style="text-align: right;">$${parseFloat(sub.cost_price || 0).toFixed(2)}</td>` : ''}
            ${showMargins ? `<td style="text-align: right;">${parseFloat(sub.margin_percentage || 0).toFixed(1)}%</td>` : ''}
            <td style="text-align: right;">$${parseFloat(sub.sell_price || 0).toFixed(2)}</td>
            <td style="text-align: right;">$${parseFloat(sub.line_total || 0).toFixed(2)}</td>
          </tr>
        `;
      });
    }
  });

  html += `
        </tbody>
      </table>

      <div class="totals">
        <table>
          <tr>
            <th>Subtotal:</th>
            <td class="text-right">$${parseFloat(quote.subtotal || 0).toFixed(2)}</td>
          </tr>
          ${parseFloat(quote.discount_amount || 0) > 0 ? `
          <tr>
            <th>Discount:</th>
            <td class="text-right">-$${parseFloat(quote.discount_amount || 0).toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr>
            <th>Tax (${quote.tax_rate}%):</th>
            <td class="text-right">$${parseFloat(quote.tax_amount || 0).toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <th>Total:</th>
            <td class="text-right">$${parseFloat(quote.total_amount || 0).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${quote.terms_conditions ? `
      <div class="terms">
        <h3>Terms and Conditions</h3>
        <p>${quote.terms_conditions}</p>
      </div>
      ` : ''}

      ${quote.notes ? `
      <div class="terms">
        <h3>Notes</h3>
        <p>${quote.notes}</p>
      </div>
      ` : ''}

      <div class="footer">
        ${template?.footer_text || 'Thank you for your business!'}
      </div>
    </body>
    </html>
  `;

  return html;
}