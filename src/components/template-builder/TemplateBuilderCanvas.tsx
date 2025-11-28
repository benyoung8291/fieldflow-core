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
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

interface TemplateBuilderCanvasProps {
  templateId?: string;
  templateData?: any;
  onSave: (json: string, thumbnail: string) => Promise<void>;
}

const SaveButton = ({ onSave, saving }: { onSave: (query: any) => void; saving: boolean }) => {
  const { query } = useEditor();
  const [showDialog, setShowDialog] = useState(false);
  
  return (
    <>
      <Button onClick={() => setShowDialog(true)} disabled={saving} size="lg">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save Template"}
      </Button>
      <TemplateNameDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSave={(name, type) => {
          onSave(query);
          setShowDialog(false);
        }}
        saving={saving}
      />
    </>
  );
};

export const TemplateBuilderCanvas = ({ 
  templateId, 
  templateData,
  onSave 
}: TemplateBuilderCanvasProps) => {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSave = async (query: any) => {
    setSaving(true);
    try {
      const json = query.serialize();
      // TODO: Generate thumbnail using html2canvas
      await onSave(json, "");
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
          <h1 className="text-lg font-semibold">Template Builder</h1>
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
        >
          {/* Toolbox */}
          <EnhancedToolbox />

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-muted/30 p-8 relative">
            <CanvasToolbar 
              onPreview={() => console.log("Preview")} 
              onExport={() => console.log("Export")} 
            />
            
            <div 
              className="max-w-[210mm] mx-auto bg-background shadow-2xl relative"
              style={{ 
                minHeight: "297mm", // A4 height
                padding: "20mm"
              }}
            >
              <Frame>
                <Element is={Container} canvas>
                  <ImageBlock width={150} height={60} />
                  <RichTextBlock text="QUOTATION" fontSize={32} fontWeight={700} textAlign="center" />
                  <DataField field="quote_number" label="Quote Number" />
                  <DataField field="customer.name" label="Customer Name" />
                  <LineItemsTable />
                </Element>
              </Frame>
            </div>
            <div className="mt-6 flex justify-center">
              <SaveButton onSave={handleSave} saving={saving} />
            </div>
          </div>

          {/* Properties Panel */}
          <AdvancedPropertiesPanel />
        </Editor>
      </div>
    </div>
  );
};