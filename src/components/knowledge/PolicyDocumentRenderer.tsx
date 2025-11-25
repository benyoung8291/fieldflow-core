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
  // Simple markdown parser for bold text, lists, etc.
  const parseMarkdown = (text: string): string => {
    let html = text;
    
    // Bold text: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text: *text* -> <em>text</em>
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
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
      {/* Hero Section */}
      <Card className="relative overflow-hidden border-2">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full -ml-24 -mb-24" />
        
        <div className="relative p-8 md:p-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              {category && (
                <Badge className="mb-3 bg-primary/20 text-primary hover:bg-primary/30">
                  {category}
                </Badge>
              )}
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
                {title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Official Policy Document
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

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
                className="text-sm hover:text-primary transition-colors flex items-center gap-2 p-2 rounded-lg hover:bg-background"
              >
                <span className="text-muted-foreground">{index + 1}.</span>
                <span>{section.title}</span>
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
              <div className="flex items-start gap-4 mb-6">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  {getSectionIcon(index)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className="font-mono text-xs">
                      {(index + 1).toString().padStart(2, '0')}
                    </Badge>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {section.title}
                    </h2>
                  </div>
                  <div 
                    className="prose prose-slate dark:prose-invert max-w-none prose-strong:text-foreground prose-strong:font-semibold"
                    dangerouslySetInnerHTML={{ 
                      __html: parseMarkdown(section.content.trim())
                    }}
                  />
                </div>
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
