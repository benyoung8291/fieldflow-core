import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';
import PizZip from 'https://esm.sh/pizzip@3.1.6';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_file_url } = await req.json();

    if (!template_file_url) {
      throw new Error('template_file_url is required');
    }

    console.log('Downloading template from:', template_file_url);

    // Download the Word document from storage
    const filePath = template_file_url.replace('document-templates/', '');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('document-templates')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download template: ${downloadError.message}`);
    }

    // Convert blob to array buffer
    const arrayBuffer = await fileData.arrayBuffer();
    
    // Parse Word document as ZIP archive
    const zip = new PizZip(arrayBuffer);
    
    // Extract the main document XML
    const documentXml = zip.file('word/document.xml')?.asText();
    
    if (!documentXml) {
      throw new Error('Could not extract document.xml from Word file');
    }

    console.log('Extracted XML length:', documentXml.length);

    // Strip out all XML tags to get plain text (Word formatting can split placeholders)
    const plainText = documentXml
      .replace(/<[^>]+>/g, '') // Remove all XML tags
      .replace(/&lt;/g, '<')   // Decode HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    console.log('Plain text sample:', plainText.substring(0, 500));

    // Extract all {{placeholder}} patterns from the plain text
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = new Set<string>();
    
    for (const match of plainText.matchAll(placeholderRegex)) {
      const placeholder = match[1].trim();
      if (placeholder) {
        placeholders.add(placeholder);
      }
    }

    // Also extract loop markers like [[SG:ItemDetails]] and [[EG:ItemDetails]]
    const loopMarkerRegex = /\[\[(SG|EG):([^\]]+)\]\]/g;
    const loopSections = new Set<string>();
    
    for (const match of plainText.matchAll(loopMarkerRegex)) {
      const sectionName = match[2].trim();
      loopSections.add(sectionName);
    }

    // Add loop section info to placeholders with special prefix
    for (const section of loopSections) {
      placeholders.add(`LOOP:${section}`);
    }

    console.log('Found placeholders:', Array.from(placeholders));

    return new Response(
      JSON.stringify({
        success: true,
        placeholders: Array.from(placeholders).sort(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error parsing template:', error);
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
