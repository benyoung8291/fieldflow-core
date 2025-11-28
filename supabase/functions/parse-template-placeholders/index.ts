import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';

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
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to text and search for placeholders
    // Word documents are ZIP files, so we need to look at the XML content
    const decoder = new TextDecoder('utf-8');
    const content = decoder.decode(uint8Array);

    // Extract all {{placeholder}} patterns
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = content.matchAll(placeholderRegex);
    const placeholders = new Set<string>();

    for (const match of matches) {
      const placeholder = match[1].trim();
      // Filter out XML or formatting artifacts
      if (placeholder && !placeholder.includes('<') && !placeholder.includes('>')) {
        placeholders.add(placeholder);
      }
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
