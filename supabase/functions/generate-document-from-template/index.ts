import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';
import Docxtemplater from 'https://esm.sh/docxtemplater@3.47.2';
import PizZip from 'https://esm.sh/pizzip@3.1.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_type, document_id, template_id, include_sub_items } = await req.json();

    if (!document_type || !document_id || !template_id) {
      throw new Error('document_type, document_id, and template_id are required');
    }

    console.log('Generating document:', { document_type, document_id, template_id });

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      throw new Error('Template not found');
    }

    // Determine whether to include sub-items (use override if provided, otherwise use template setting)
    const shouldIncludeSubItems = include_sub_items !== undefined ? include_sub_items : template.include_sub_items;

    // Fetch document data based on type
    let documentData: any;
    let lineItems: any[] = [];

    if (document_type === 'quote') {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', document_id)
        .single();

      if (quoteError) throw quoteError;
      documentData = quote;

      // Fetch profile if quote has a created_by
      if (quote.created_by) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', quote.created_by)
          .single();
        
        if (!profileError && profile) {
          documentData.profile = profile;
        }
      }

      // Fetch contact if quote has a contact_id
      if (quote.contact_id) {
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', quote.contact_id)
          .single();
        
        if (!contactError && contact) {
          documentData.contact = contact;
        }
      }

      // Fetch location if quote has a location_id
      if (quote.location_id) {
        const { data: location, error: locationError } = await supabase
          .from('customer_locations')
          .select('*')
          .eq('id', quote.location_id)
          .single();
        
        if (!locationError && location) {
          documentData.location = location;
        }
      }

      // Fetch line items
      const { data: items, error: itemsError } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', document_id)
        .order('item_order');

      if (itemsError) throw itemsError;

      // Filter based on sub-items setting
      if (shouldIncludeSubItems) {
        lineItems = items || [];
      } else {
        // Only parent items
        lineItems = (items || []).filter(item => !item.parent_line_item_id);
      }
    } else if (document_type === 'purchase_order') {
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('id', document_id)
        .single();

      if (poError) throw poError;
      documentData = po;

      // Fetch line items
      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_line_items')
        .select('*')
        .eq('purchase_order_id', document_id)
        .order('item_order');

      if (itemsError) throw itemsError;
      lineItems = items || [];
    } else if (document_type === 'invoice') {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', document_id)
        .single();

      if (invoiceError) throw invoiceError;
      documentData = invoice;

      // Fetch line items
      const { data: items, error: itemsError } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', document_id)
        .order('item_order');

      if (itemsError) throw itemsError;
      lineItems = items || [];
    }

    // Build data object for placeholder replacement
    const replacementData: Record<string, any> = {};
    const fieldMappings = template.field_mappings || {};

    // Map placeholders to values based on field_mappings
    for (const [placeholder, systemField] of Object.entries(fieldMappings)) {
      const fieldPath = String(systemField).split('.');
      let value = documentData;

      // Navigate through the object path
      for (const key of fieldPath) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          value = '';
          break;
        }
      }

      // Format dates
      if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        value = new Date(value).toLocaleDateString();
      }

      // Format numbers
      if (typeof value === 'number') {
        value = value.toFixed(2);
      }

      replacementData[String(placeholder)] = value || '';
    }

    // Handle line items
    const lineItemsData = lineItems.map(item => {
      const itemData: Record<string, any> = {};
      
      // Map line item fields
      for (const [placeholder, systemField] of Object.entries(fieldMappings)) {
        const fieldStr = String(systemField);
        if (fieldStr.startsWith('line_item.')) {
          const field = fieldStr.replace('line_item.', '');
          let value = item[field];

          // Format numbers
          if (typeof value === 'number') {
            value = value.toFixed(2);
          }

          itemData[String(placeholder).replace('line_item.', '')] = value || '';
        }
      }

      return itemData;
    });

    // Download the template file from Supabase storage
    // Extract file path from URL (template_file_url might be a full URL)
    let filePath = template.template_file_url;
    console.log('Original file URL:', filePath);
    
    // Remove bucket name prefix if present (both with dash and underscore)
    if (filePath.startsWith('document-templates/')) {
      filePath = filePath.replace('document-templates/', '');
    } else if (filePath.startsWith('document_templates/')) {
      filePath = filePath.replace('document_templates/', '');
    } else if (filePath.includes('/storage/v1/object/public/document_templates/')) {
      filePath = filePath.split('/storage/v1/object/public/document_templates/')[1];
    } else if (filePath.includes('/storage/v1/object/document_templates/')) {
      filePath = filePath.split('/storage/v1/object/document_templates/')[1];
    }
    
    console.log('Extracted file path:', filePath);
    
    const { data: fileData, error: fileError } = await supabase.storage
      .from('document-templates')
      .download(filePath);

    if (fileError || !fileData) {
      console.error('Download error:', fileError);
      throw new Error('Failed to download template file');
    }

    // Load the docx file as a binary
    const arrayBuffer = await fileData.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    
    // Fix broken placeholders caused by Word formatting
    // Word often splits placeholders across multiple <w:t> runs, creating patterns like:
    // <w:t>{{</w:t><w:t>{{</w:t><w:t>Quote_Number</w:t><w:t>}}</w:t>
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];
    xmlFiles.forEach(fileName => {
      try {
        let content = zip.files[fileName]?.asText();
        if (content) {
          // Strategy: Find sequences that look like placeholders spanning multiple runs and merge them
          // Look for patterns starting with {{ and ending with }} (with any content/tags in between)
          content = content.replace(/<w:r[^>]*>(?:[^<]|<(?!w:r))*?<w:t[^>]*>\{\{[^<]*<\/w:t>.*?<w:t[^>]*>[^<]*\}\}<\/w:t>(?:[^<]|<(?!w:r))*?<\/w:r>/g, (match) => {
            // Extract all text content from w:t tags in this sequence
            const textMatches = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
            const fullText = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
            
            // Clean up: remove duplicate {{ and }}
            const cleaned = fullText.replace(/\{\{+/g, '{{').replace(/\}\}+/g, '}}');
            
            // Return a single, clean run
            return `<w:r><w:t>${cleaned}</w:t></w:r>`;
          });
          
          // Also handle cases where runs are completely separate
          // Merge adjacent runs that contain parts of placeholders
          let lastMatch = '';
          do {
            lastMatch = content;
            // Find adjacent runs that together form a placeholder
            content = content.replace(/(<w:r[^>]*><w:t[^>]*>)([^<]*\{\{?)(<\/w:t><\/w:r>)\s*(<w:r[^>]*><w:t[^>]*>)([^<]*?)(<\/w:t><\/w:r>)/g, 
              (match, open1, text1, close1, open2, text2, close2) => {
                const combined = text1 + text2;
                // If this looks like it's part of a placeholder, merge the runs
                if (combined.includes('{{') || combined.includes('}}')) {
                  return `<w:r><w:t>${combined}</w:t></w:r>`;
                }
                return match;
              }
            );
          } while (content !== lastMatch && lastMatch.length > 0);
          
          // Final cleanup: remove any remaining duplicate delimiters
          content = content.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (match, attrs, text) => {
            const cleaned = text.replace(/\{\{+/g, '{{').replace(/\}\}+/g, '}}');
            return `<w:t${attrs}>${cleaned}</w:t>`;
          });
          
          zip.file(fileName, content);
        }
      } catch (e) {
        console.error(`Error fixing ${fileName}:`, e);
      }
    });
    
    // Initialize docxtemplater with lenient syntax to handle any remaining issues
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      syntax: {
        allowUnopenedTag: true,
      },
    });

    // Prepare data for template
    const templateData = {
      ...replacementData,
      line_items: lineItemsData,
    };

    // Set the data
    doc.setData(templateData);

    // Render the document
    try {
      doc.render();
    } catch (error: any) {
      console.error('Error rendering document:', error);
      throw new Error('Failed to render template: ' + (error?.message || 'Unknown error'));
    }

    // Generate the filled document
    const filledDoc = doc.getZip().generate({
      type: 'uint8array',
      compression: 'DEFLATE',
    });

    // Convert to base64 for transmission
    const base64 = btoa(String.fromCharCode(...filledDoc));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document generated successfully',
        data: {
          file: base64,
          filename: template.original_filename.replace('.docx', '-filled.docx'),
          template_name: template.name,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating document:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
