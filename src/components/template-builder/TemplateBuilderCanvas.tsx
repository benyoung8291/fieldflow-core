import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Container } from "./craft/Container";
import { RichTextBlock } from "./craft/RichTextBlock";
import { DataField } from "./craft/DataField";
import { LineItemsTable } from "./craft/LineItemsTable";
import { ImageBlock } from "./craft/ImageBlock";
import { ShapeBlock } from "./craft/ShapeBlock";
import { EnhancedToolbox } from "./EnhancedToolbox";
import { AdvancedPropertiesPanel } from "./AdvancedPropertiesPanel";
import { CanvasToolbar } from "./CanvasToolbar";
import { TemplateNameDialog } from "./TemplateNameDialog";
import { GradientBackground } from "./craft/GradientBackground";
import { TemplateLoader } from "./TemplateLoader";
import { useState, useEffect } from "react";
import { getDefaultTemplate } from "@/lib/defaultTemplates";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface TemplateBuilderCanvasProps {
  templateId?: string;
  templateData?: any;
  onSave: (json: string, thumbnail: string, name: string, documentType: string) => Promise<void>;
}

const SaveButton = ({ onSave, saving, templateName, setTemplateName, documentType, setDocumentType }: { 
  onSave: (query: any, name: string, docType: string) => void; 
  saving: boolean;
  templateName: string;
  setTemplateName: (name: string) => void;
  documentType: string;
  setDocumentType: (type: string) => void;
}) => {
  const { query } = useEditor();
  
  return (
    <Button onClick={() => onSave(query, templateName, documentType)} disabled={saving} size="lg">
      <Save className="mr-2 h-4 w-4" />
      {saving ? "Saving..." : "Save Template"}
    </Button>
  );
};

export const TemplateBuilderCanvas = ({ 
  templateId, 
  templateData,
  onSave 
}: TemplateBuilderCanvasProps) => {
  const [saving, setSaving] = useState(false);
  const [documentType, setDocumentType] = useState<string>("quote");
  const [templateName, setTemplateName] = useState<string>("Untitled Template");
  const [pageMargins, setPageMargins] = useState({ top: 20, right: 20, bottom: 20, left: 20 }); // in mm
  const navigate = useNavigate();
  const [loadedTemplate, setLoadedTemplate] = useState<string | null>(null);

  // Load default template when document type changes (only for new templates)
  useEffect(() => {
    if (!templateId) {
      const defaultTemplate = getDefaultTemplate(documentType);
      setLoadedTemplate(JSON.stringify(defaultTemplate));
    }
  }, [documentType, templateId]);

  const handleSave = async (query: any, name: string, docType: string) => {
    setSaving(true);
    try {
      const json = query.serialize();
      // TODO: Generate thumbnail using html2canvas
      await onSave(json, "", name, docType);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Template Builder</h1>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-sm text-muted-foreground bg-transparent border-none outline-none focus:ring-0"
              placeholder="Template name"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Document Type:</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                <SelectItem value="field_report">Field Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Editor
          resolver={{ 
            Container, 
            RichTextBlock, 
            DataField, 
            LineItemsTable,
            ImageBlock,
            ShapeBlock,
            GradientBackground
          }}
          indicator={{
            success: "hsl(var(--primary))",
            error: "hsl(var(--destructive))",
          }}
          enabled={true}
        >
          {/* Toolbox */}
          <EnhancedToolbox documentType={documentType} />

          {/* Template Loader - loads default templates */}
          <TemplateLoader templateJson={loadedTemplate} />

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-muted/30 p-8 relative">
            <CanvasToolbar 
              onPreview={() => console.log("Preview")} 
              onExport={() => console.log("Export")}
              pageMargins={pageMargins}
              onPageMarginsChange={setPageMargins}
            />
            
            <div 
              className="max-w-[210mm] mx-auto bg-background shadow-2xl relative"
              style={{ 
                width: "210mm", // A4 width
                minHeight: "297mm", // A4 height
                paddingTop: `${pageMargins.top}mm`,
                paddingRight: `${pageMargins.right}mm`,
                paddingBottom: `${pageMargins.bottom}mm`,
                paddingLeft: `${pageMargins.left}mm`
              }}
            >
              <Frame>
                <Element is={Container} canvas />
              </Frame>
            </div>
            <div className="mt-6 flex justify-center">
              <SaveButton 
                onSave={handleSave} 
                saving={saving}
                templateName={templateName}
                setTemplateName={setTemplateName}
                documentType={documentType}
                setDocumentType={setDocumentType}
              />
            </div>
          </div>

          {/* Properties Panel */}
          <AdvancedPropertiesPanel />
        </Editor>
      </div>
    </div>
  );
};