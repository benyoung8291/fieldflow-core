import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FabricCanvasComponent } from "./fabric/FabricCanvas";
import { FabricToolbox } from "./fabric/FabricToolbox";
import { FabricPropertiesPanel } from "./fabric/FabricPropertiesPanel";
import { FabricToolbar } from "./fabric/FabricToolbar";
import { useFabricEditor } from "@/hooks/useFabricEditor";
import { fabricDefaultTemplates } from "@/lib/fabricTemplates";

interface TemplateBuilderCanvasProps {
  templateId?: string;
  templateData?: any;
  onSave: (json: string, thumbnail: string, name: string, documentType: string) => Promise<void>;
}

export const TemplateBuilderCanvas = ({ templateId, templateData, onSave }: TemplateBuilderCanvasProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [documentType, setDocumentType] = useState("quote");
  const [templateName, setTemplateName] = useState("Untitled Template");
  const [canvas, setCanvas] = useState<any>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const { 
    activeObject, 
    duplicateSelected, 
    deleteSelected, 
    bringToFront, 
    sendToBack 
  } = useFabricEditor();

  // Load template data or default template
  useEffect(() => {
    const loadTemplate = async () => {
      if (templateId && templateData) {
        // Load existing template
        setTemplateName(templateData.name || "Untitled Template");
        setDocumentType(templateData.document_type || "quote");
        
        if (canvas && templateData.template_json) {
          await canvas.loadFromJSON(templateData.template_json);
          canvas.renderAll();
        }
      } else if (!templateId && documentType && canvas) {
        // Load default template for new templates
        const defaultTemplate = fabricDefaultTemplates[documentType];
        if (defaultTemplate) {
          await canvas.loadFromJSON(defaultTemplate);
          canvas.renderAll();
        }
      }
    };

    loadTemplate();
  }, [templateId, templateData, documentType, canvas]);

  const handleSave = async () => {
    if (!canvas) return;
    
    setIsSaving(true);
    try {
      // Serialize canvas to JSON
      const json = canvas.toJSON();
      
      // Generate thumbnail
      const thumbnail = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.5,
      });

      await onSave(JSON.stringify(json), thumbnail, templateName, documentType);
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-border px-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings/templates")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="template-name">Template Name:</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="doc-type">Document Type:</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="doc-type" className="w-48">
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
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </div>

      {/* Toolbar */}
      <FabricToolbar canvas={canvas} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <FabricToolbox canvas={canvas} documentType={documentType} />
        
        <div className="flex-1 overflow-auto">
          <FabricCanvasComponent 
            onReady={setCanvas}
            onSelectionChange={setSelectedObject}
          />
        </div>

        <FabricPropertiesPanel
          canvas={canvas}
          activeObject={selectedObject}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
        />
      </div>
    </div>
  );
};
