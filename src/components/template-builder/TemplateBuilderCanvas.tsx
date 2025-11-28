import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Container } from "./craft/Container";
import { TextBlock } from "./craft/TextBlock";
import { DataField } from "./craft/DataField";
import { LineItemsTable } from "./craft/LineItemsTable";
import { TemplateToolbox } from "./TemplateToolbox";
import { TemplateSettings } from "./TemplateSettings";
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
  
  return (
    <Button onClick={() => onSave(query)} disabled={saving}>
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
          resolver={{ Container, TextBlock, DataField, LineItemsTable }}
        >
          {/* Toolbox */}
          <TemplateToolbox />

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-muted p-8">
            <div 
              className="max-w-[210mm] mx-auto bg-background shadow-lg"
              style={{ 
                minHeight: "297mm", // A4 height
                padding: "20mm"
              }}
            >
              <Frame>
                <Element is={Container} canvas>
                  <TextBlock text="Your Company Name" fontSize={24} fontWeight={700} />
                  <DataField field="quote_number" label="Quote Number" />
                  <DataField field="customer.name" label="Customer Name" />
                  <LineItemsTable />
                </Element>
              </Frame>
            </div>
            <div className="mt-4 flex justify-center">
              <SaveButton onSave={handleSave} saving={saving} />
            </div>
          </div>

          {/* Properties Panel */}
          <TemplateSettings />
        </Editor>
      </div>
    </div>
  );
};