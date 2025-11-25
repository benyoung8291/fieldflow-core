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

    // Convert markdown-style content to HTML
    const formatContent = (content: string) => {
      return content
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Paragraphs
        .split('\n\n')
        .map(para => {
          if (para.trim().startsWith('<h')) return para;
          if (para.trim().startsWith('-')) {
            const items = para.split('\n').filter(line => line.trim().startsWith('-'));
            return '<ul>' + items.map(item => `<li>${item.substring(1).trim()}</li>`).join('') + '</ul>';
          }
          if (para.trim()) return `<p>${para.replace(/\n/g, '<br>')}</p>`;
          return '';
        })
        .join('\n');
    };

    const formattedContent = formatContent(article.content);

    // Beautiful PDF design
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${article.title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page {
              margin: 20mm 15mm;
              size: A4;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.7;
              color: #1a1a1a;
              background: white;
            }
            
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 50px 30px;
              position: relative;
              overflow: hidden;
              margin: -20mm -15mm 0;
            }
            
            .header::before {
              content: '';
              position: absolute;
              top: 0;
              right: 0;
              width: 400px;
              height: 400px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 50%;
              transform: translate(30%, -30%);
            }
            
            .category-badge {
              display: inline-block;
              padding: 8px 20px;
              background: rgba(255, 255, 255, 0.2);
              backdrop-filter: blur(10px);
              border-radius: 50px;
              font-size: 13px;
              font-weight: 600;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              margin-bottom: 24px;
              border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            h1 {
              font-size: 36px;
              font-weight: 700;
              margin-bottom: 12px;
              line-height: 1.2;
              position: relative;
            }
            
            .summary {
              font-size: 16px;
              opacity: 0.95;
              line-height: 1.6;
              margin-top: 12px;
              font-weight: 400;
            }
            
            .content-wrapper {
              padding: 40px 0;
              max-width: 100%;
            }
            
            .content {
              font-size: 16px;
              line-height: 1.8;
              color: #2d3748;
            }
            
            .content h1, .content h2, .content h3 {
              color: #1a202c;
              margin-top: 32px;
              margin-bottom: 12px;
              font-weight: 600;
            }
            
            .content h1 { font-size: 28px; }
            .content h2 { font-size: 22px; }
            .content h3 { font-size: 18px; }
            
            .content p {
              margin-bottom: 12px;
            }
            
            .content ul, .content ol {
              margin: 12px 0 12px 24px;
            }
            
            .content li {
              margin-bottom: 6px;
              padding-left: 8px;
            }
            
            .content strong {
              font-weight: 600;
              color: #1a202c;
            }
            
            .content blockquote {
              border-left: 4px solid #667eea;
              padding-left: 20px;
              margin: 20px 0;
              font-style: italic;
              color: #4a5568;
            }
            
            .content code {
              background: #f7fafc;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
              font-size: 14px;
              color: #e53e3e;
            }
            
            .footer {
              background: #f7fafc;
              padding: 30px 50px;
              margin: 40px -15mm -20mm;
              border-top: 1px solid #e2e8f0;
            }
            
            .metadata {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 20px;
            }
            
            .metadata-item {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            
            .metadata-label {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #718096;
              font-weight: 600;
            }
            
            .metadata-value {
              font-size: 16px;
              color: #2d3748;
              font-weight: 500;
            }
            
            .footer-note {
              text-align: center;
              color: #a0aec0;
              font-size: 12px;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
            
            @media print {
              .header {
                break-inside: avoid;
              }
              
              .content h1, .content h2, .content h3 {
                break-after: avoid;
              }
              
              .content p, .content ul, .content ol {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${article.knowledge_categories ? `<div class="category-badge">${article.knowledge_categories.name}</div>` : ''}
            <h1>${article.title}</h1>
            ${article.summary ? `<div class="summary">${article.summary}</div>` : ''}
          </div>
          
          <div class="content-wrapper">
            <div class="content">${formattedContent}</div>
          </div>
          
          <div class="footer">
            <div class="metadata">
              <div class="metadata-item">
                <div class="metadata-label">Created</div>
                <div class="metadata-value">${new Date(article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              <div class="metadata-item">
                <div class="metadata-label">Last Updated</div>
                <div class="metadata-value">${new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              <div class="metadata-item">
                <div class="metadata-label">Views</div>
                <div class="metadata-value">${article.view_count.toLocaleString()}</div>
              </div>
            </div>
            <div class="footer-note">
              Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </body>
      </html>
    `

    // Return HTML optimized for printing to PDF
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
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
