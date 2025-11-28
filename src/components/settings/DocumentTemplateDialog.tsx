import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, FileCheck } from "lucide-react";
import PlaceholderMappingList from "./PlaceholderMappingList";

interface DocumentTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any | null;
  defaultDocumentType?: string;
}

export default function DocumentTemplateDialog({ 
  open, 
  onOpenChange, 
  template,
  defaultDocumentType = 'quote'
}: DocumentTemplateDialogProps) {
  const [step, setStep] = useState<'upload' | 'extract' | 'map'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    document_type: defaultDocumentType,
    description: "",
    include_sub_items: true,
    is_default: false,
  });
  const [extractedPlaceholders, setExtractedPlaceholders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (template) {
        setFormData({
          name: template.name,
          document_type: template.document_type,
          description: template.description || "",
          include_sub_items: template.include_sub_items,
          is_default: template.is_default,
        });
        setExtractedPlaceholders(template.extracted_placeholders || []);
        setFieldMappings(template.field_mappings || {});
        setUploadedFileUrl(template.template_file_url);
        setStep('map');
      } else {
        setFormData({
          name: "",
          document_type: defaultDocumentType,
          description: "",
          include_sub_items: true,
          is_default: false,
        });
        setExtractedPlaceholders([]);
        setFieldMappings({});
        setStep('upload');
        setFile(null);
        setUploadedFileUrl("");
      }
    }
  }, [open, template, defaultDocumentType]);

  const uploadFile = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.tenant_id}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('document-templates')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    return `document-templates/${fileName}`;
  };

  const extractPlaceholders = useMutation({
    mutationFn: async (fileUrl: string) => {
      const { data, error } = await supabase.functions.invoke('parse-template-placeholders', {
        body: { template_file_url: fileUrl },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.placeholders as string[];
    },
    onSuccess: (placeholders) => {
      setExtractedPlaceholders(placeholders);
      setStep('map');
      toast.success(`Found ${placeholders.length} placeholders`);
    },
    onError: (error: any) => {
      toast.error("Failed to extract placeholders: " + error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.docx')) {
        toast.error("Please select a .docx file");
        return;
      }
      setFile(selectedFile);
      if (formData.name === "") {
        setFormData(prev => ({ ...prev, name: selectedFile.name.replace('.docx', '') }));
      }
    }
  };

  const handleExtractPlaceholders = async () => {
    if (!file && !uploadedFileUrl) {
      toast.error("Please upload a file first");
      return;
    }

    setExtracting(true);
    try {
      let fileUrl = uploadedFileUrl;
      
      if (file) {
        fileUrl = await uploadFile(file);
        setUploadedFileUrl(fileUrl);
      }

      await extractPlaceholders.mutateAsync(fileUrl);
    } catch (error: any) {
      toast.error("Failed to process file: " + error.message);
    } finally {
      setExtracting(false);
    }
  };

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      let fileUrl = uploadedFileUrl;

      // Upload file if new
      if (file && !template) {
        fileUrl = await uploadFile(file);
      }

      const templateData = {
        tenant_id: profile.tenant_id,
        name: formData.name,
        document_type: formData.document_type,
        description: formData.description || null,
        template_file_url: fileUrl,
        original_filename: file?.name || template?.original_filename,
        extracted_placeholders: extractedPlaceholders,
        field_mappings: fieldMappings,
        include_sub_items: formData.include_sub_items,
        is_default: formData.is_default,
        created_by: user.id,
      };

      if (template) {
        const { error } = await supabase
          .from("document_templates")
          .update(templateData)
          .eq("id", template.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("document_templates")
          .insert(templateData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success(template ? "Template updated" : "Template created");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Failed to save template: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit" : "Add"} Document Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Upload */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard Quote Template"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_type">Document Type *</Label>
                <Select 
                  value={formData.document_type} 
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  disabled={!!template}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="purchase_order">Purchase Order</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            {!template && (
              <div className="space-y-2">
                <Label htmlFor="file">Upload Word Template (.docx) *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  {file && <FileCheck className="h-5 w-5 text-green-600" />}
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            )}

            {step === 'upload' && (
              <Button 
                onClick={handleExtractPlaceholders} 
                disabled={extracting || (!file && !template)}
                className="w-full"
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reading Template...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Read Template & Extract Placeholders
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Step 2 & 3: Extract & Map */}
          {step === 'map' && extractedPlaceholders.length > 0 && (
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Field Mappings</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Map the placeholders found in your template to system fields
                </p>
                <PlaceholderMappingList
                  placeholders={extractedPlaceholders}
                  documentType={formData.document_type}
                  mappings={fieldMappings}
                  onChange={setFieldMappings}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Label htmlFor="include_sub_items">
                  Include sub-items in this template
                  {formData.document_type === 'quote' && (
                    <span className="block text-xs text-muted-foreground font-normal mt-1">
                      When enabled, child line items will be included in the document
                    </span>
                  )}
                </Label>
                <Switch
                  id="include_sub_items"
                  checked={formData.include_sub_items}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, include_sub_items: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_default">Set as default template</Label>
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_default: checked })
                  }
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === 'map' && (
              <Button 
                onClick={() => saveTemplate.mutate()}
                disabled={saveTemplate.isPending || !formData.name}
              >
                {saveTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {template ? "Update Template" : "Create Template"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
