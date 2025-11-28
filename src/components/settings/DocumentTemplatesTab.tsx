import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, Download } from "lucide-react";
import DocumentTemplateDialog from "./DocumentTemplateDialog";

interface DocumentTemplate {
  id: string;
  name: string;
  document_type: string;
  original_filename: string;
  extracted_placeholders: string[];
  field_mappings: Record<string, string>;
  include_sub_items: boolean;
  is_default: boolean;
  description: string | null;
  template_file_url: string;
}

export default function DocumentTemplatesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<'quote' | 'purchase_order' | 'invoice'>('quote');
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as DocumentTemplate[];
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (template: DocumentTemplate) => {
      // Delete file from storage
      const filePath = template.template_file_url.replace('document-templates/', '');
      const { error: storageError } = await supabase.storage
        .from('document-templates')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file:', storageError);
      }

      // Delete database record
      const { error } = await supabase
        .from("document_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Template deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const handleEdit = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedTemplate(null);
    setIsDialogOpen(true);
  };

  const handleDownload = async (template: DocumentTemplate) => {
    try {
      const filePath = template.template_file_url.replace('document-templates/', '');
      const { data, error } = await supabase.storage
        .from('document-templates')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = template.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Template downloaded");
    } catch (error: any) {
      console.error('Error downloading template:', error);
      toast.error("Failed to download template");
    }
  };

  const filteredTemplates = templates.filter(t => t.document_type === selectedDocType);

  const renderTemplateTable = (docType: string) => {
    const typeTemplates = templates.filter(t => t.document_type === docType);

    if (typeTemplates.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No templates created yet</p>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Mappings</TableHead>
            <TableHead>Sub-items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {typeTemplates.map((template) => (
            <TableRow key={template.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {template.name}
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {template.original_filename}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {Object.keys(template.field_mappings || {}).length} mapped
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={template.include_sub_items ? "default" : "outline"}>
                  {template.include_sub_items ? "Included" : "Parent only"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={template.is_default ? "default" : "outline"}>
                  {template.is_default ? "Default" : "Available"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(template)}
                    title="Download template"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this template?")) {
                        deleteTemplate.mutate(template);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Word Document Templates</h3>
          <p className="text-sm text-muted-foreground">
            Upload Word documents with custom placeholders for quotes, purchase orders, and invoices
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <Tabs value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quote">Quotes</TabsTrigger>
          <TabsTrigger value="purchase_order">Purchase Orders</TabsTrigger>
          <TabsTrigger value="invoice">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="quote" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            renderTemplateTable('quote')
          )}
        </TabsContent>

        <TabsContent value="purchase_order" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            renderTemplateTable('purchase_order')
          )}
        </TabsContent>

        <TabsContent value="invoice" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            renderTemplateTable('invoice')
          )}
        </TabsContent>
      </Tabs>

      <DocumentTemplateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        template={selectedTemplate}
        defaultDocumentType={selectedDocType}
      />
    </div>
  );
}
