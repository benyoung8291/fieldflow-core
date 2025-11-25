export function parseMarkdown(text: string): string {
  let html = text;
  
  // Bold text first: **text** -> <strong>text</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  
  // Italic text: *text* -> <em>text</em>
  html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  
  // Headers (must be done before line breaks)
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-semibold mt-4 mb-2">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>');
  
  // Unordered lists (- or *)
  html = html.replace(/^[\*\-] (.+)$/gm, '<li class="ml-6 my-1">$1</li>');
  html = html.replace(/(<li class="ml-6 my-1">.+?<\/li>\s*)+/gs, '<ul class="list-disc list-outside my-3 space-y-1">$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-6 my-1">$1</li>');
  html = html.replace(/(<li class="ml-6 my-1">.+?<\/li>\s*)+/gs, (match) => {
    // Only wrap if it's not already wrapped in ul
    if (!match.includes('<ul')) {
      return `<ol class="list-decimal list-outside my-3 space-y-1">${match}</ol>`;
    }
    return match;
  });
  
  // Paragraphs - preserve double line breaks as paragraph breaks
  html = html.replace(/\n\n+/g, '</p><p class="my-3">');
  html = `<p class="my-3">${html}</p>`;
  
  // Single line breaks within paragraphs
  html = html.replace(/\n(?!<)/g, '<br />');
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="my-3"><\/p>/g, '');
  html = html.replace(/<p class="my-3">\s*<br \/>\s*<\/p>/g, '');
  
  return html;
}
