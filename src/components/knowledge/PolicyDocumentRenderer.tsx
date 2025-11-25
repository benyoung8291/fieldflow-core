import { FileText, AlertCircle, CheckCircle, Info, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PolicySection {
  title: string;
  content: string;
}

interface PolicyDocumentRendererProps {
  content: string;
  title: string;
  category?: string;
}

export function PolicyDocumentRenderer({
  content,
  title,
  category,
}: PolicyDocumentRendererProps) {
  // Enhanced markdown parser
  const parseMarkdown = (text: string): string => {
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
  };

  // Parse the markdown content into sections
  const parseSections = (text: string): PolicySection[] => {
    const sections: PolicySection[] = [];
    const lines = text.split('\n');
    let currentSection: PolicySection | null = null;

    for (const line of lines) {
      // Match ## headers
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace('## ', '').trim(),
          content: '',
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  };

  const sections = parseSections(content);

  const getSectionIcon = (index: number) => {
    const icons = [Shield, FileText, AlertCircle, CheckCircle, Info];
    const Icon = icons[index % icons.length];
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-8">

      {/* Table of Contents */}
      {sections.length > 0 && (
        <Card className="p-6 bg-muted/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Contents
          </h2>
          <div className="grid gap-2">
            {sections.map((section, index) => (
              <a
                key={index}
                href={`#section-${index}`}
                className="text-sm hover:text-primary transition-colors p-2 rounded-lg hover:bg-background block"
              >
                {section.title}
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Policy Sections - Single Card */}
      <Card className="p-8 md:p-12">
        <div className="space-y-12">
          {sections.map((section, index) => (
            <div
              key={index}
              id={`section-${index}`}
              className="scroll-mt-4"
            >
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                {section.title}
              </h2>
              <div 
                className="prose prose-slate dark:prose-invert max-w-none prose-strong:text-foreground prose-strong:font-semibold"
                dangerouslySetInnerHTML={{ 
                  __html: parseMarkdown(section.content.trim())
                }}
              />
            </div>
              {index < sections.length - 1 && (
                <Separator className="mt-8" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Footer Card */}
      <Card className="p-6 bg-muted/30 border-l-4 border-l-primary">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Important Notice</h3>
            <p className="text-sm text-muted-foreground">
              This policy is subject to periodic review and updates. Employees are expected to
              familiarize themselves with and comply with all provisions outlined in this document.
              For questions or clarifications, please contact your supervisor or the HR department.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
