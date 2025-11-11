import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface MobileSection {
  id: string;
  label: string;
  content: ReactNode;
}

interface MobileDetailLayoutProps {
  title: string;
  subtitle?: string;
  status?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  };
  actionBar?: ReactNode;
  keyInfo?: ReactNode;
  sections: MobileSection[];
  defaultOpenSections?: string[];
}

export const MobileDetailLayout = ({
  title,
  subtitle,
  status,
  actionBar,
  keyInfo,
  sections,
  defaultOpenSections = [sections[0]?.id],
}: MobileDetailLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="flex items-center gap-3 p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {status && (
            <Badge
              variant={status.variant || "default"}
              className={cn("flex-shrink-0", status.className)}
            >
              {status.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {actionBar && <div>{actionBar}</div>}

      {/* Key Info */}
      {keyInfo && (
        <div className="p-3 space-y-2">
          {keyInfo}
        </div>
      )}

      {/* Sections as Accordion */}
      <div className="px-3">
        <Accordion
          type="multiple"
          defaultValue={defaultOpenSections}
          className="space-y-2"
        >
          {sections.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-medium">{section.label}</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};
