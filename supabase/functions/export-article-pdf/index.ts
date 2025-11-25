import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { articleId } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Fetch article data
    const { data: article, error } = await supabaseClient
      .from('knowledge_articles')
      .select(`
        *,
        knowledge_categories (
          name,
          color
        )
      `)
      .eq('id', articleId)
      .single()

    if (error) throw error

    // Simple HTML to PDF conversion
    // In production, you would use a proper PDF generation library
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${article.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            .category { display: inline-block; padding: 4px 12px; background: #f0f0f0; border-radius: 4px; margin-bottom: 20px; }
            .content { line-height: 1.6; }
            .metadata { color: #666; font-size: 14px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          ${article.knowledge_categories ? `<div class="category">${article.knowledge_categories.name}</div>` : ''}
          <h1>${article.title}</h1>
          ${article.summary ? `<p><strong>${article.summary}</strong></p>` : ''}
          <div class="content">${article.content}</div>
          <div class="metadata">
            <p>Created: ${new Date(article.created_at).toLocaleDateString()}</p>
            <p>Last Updated: ${new Date(article.updated_at).toLocaleDateString()}</p>
            <p>Views: ${article.view_count}</p>
          </div>
        </body>
      </html>
    `

    // Note: This is a placeholder. In production, use a proper PDF generation service
    // For now, we'll return HTML that can be printed to PDF by the browser
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
