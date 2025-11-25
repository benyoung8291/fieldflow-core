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
    
    // Headers (###, ##, #)
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-semibold mt-4 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
    
    // Tables - convert pipe tables to HTML tables
    html = html.replace(/\n(\|.+\|\n)+/g, (match) => {
      const rows = match.trim().split('\n');
      const headerRow = rows[0];
      const separatorRow = rows[1];
      const bodyRows = rows.slice(2);
      
      if (separatorRow && separatorRow.match(/\|[-:\s]+\|/)) {
        const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
        const tableRows = bodyRows.map(row => 
          row.split('|').map(cell => cell.trim()).filter(cell => cell)
        );
        
        let tableHtml = '<table class="w-full my-4 border-collapse"><thead><tr>';
        headers.forEach(header => {
          tableHtml += `<th class="border border-border p-2 text-left font-semibold bg-muted">${header}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        tableRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            tableHtml += `<td class="border border-border p-2">${cell}</td>`;
          });
          tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        return tableHtml;
      }
      return match;
    });
    
    // Unordered lists
    html = html.replace(/^\* (.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li class="ml-4">.+<\/li>\n?)+/g, '<ul class="list-disc list-inside my-2">$&</ul>');
    
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');
    
    // Bold text: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text: *text* -> <em>text</em> (but not already processed asterisks)
    html = html.replace(/(?<![*\w])\*([^*]+)\*(?![*\w])/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    
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
