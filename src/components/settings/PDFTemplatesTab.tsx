import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, FileImage, Edit, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Canvas as FabricCanvas } from "fabric";

interface PDFTemplate {
  id: string;
  name: string;
  document_type: string;
  is_default: boolean;
  template_json: any;
  thumbnail_url: string | null;
  template_image_url: string | null;
  created_at: string;
}

export default function PDFTemplatesTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["pdf-templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("pdf_templates")
        .select("*")
        .eq("tenant_id", profile?.tenant_id)
        .order("document_type, name");

      if (error) throw error;
      return data as PDFTemplate[];
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async ({ id, documentType }: { id: string; documentType: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      // Unset all defaults for this document type
      await supabase
        .from("pdf_templates")
        .update({ is_default: false })
        .eq("tenant_id", profile?.tenant_id)
        .eq("document_type", documentType);

      // Set the new default
      const { error } = await supabase
        .from("pdf_templates")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
      toast.success("Default template updated");
    },
    onError: () => {
      toast.error("Failed to update default template");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pdf_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
      toast.success("Template deleted successfully");
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const handleRegenerateAll = async () => {
    setRegenerating(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const template of templates) {
        if (!template.template_json) {
          errorCount++;
          continue;
        }

        try {
          // Create offscreen canvas
          const canvas = new FabricCanvas(null, {
            width: 2480,
            height: 3508,
          });

          await new Promise<void>((resolve, reject) => {
            canvas.loadFromJSON(template.template_json, async () => {
              try {
                canvas.renderAll();

                // Generate high-res image
                const hiResImage = canvas.toDataURL({
                  format: "png",
                  quality: 1,
                  multiplier: 1,
                });

                // Generate thumbnail
                const thumbnail = canvas.toDataURL({
                  format: "png",
                  quality: 0.8,
                  multiplier: 0.2,
                });

                canvas.dispose();

                // Update database
                const { error } = await supabase
                  .from("pdf_templates")
                  .update({
                    template_image_url: hiResImage,
                    thumbnail_url: thumbnail,
                  })
                  .eq("id", template.id);

                if (error) throw error;
                successCount++;
                resolve();
              } catch (err) {
                canvas.dispose();
                errorCount++;
                reject(err);
              }
            });
          });
        } catch (err) {
          console.error(`Failed to regenerate template ${template.name}:`, err);
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pdf-templates"] });
      
      if (errorCount === 0) {
        toast.success(`Successfully regenerated ${successCount} template(s)`);
      } else {
        toast.warning(`Regenerated ${successCount} template(s), ${errorCount} failed`);
      }
    } finally {
      setRegenerating(false);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      quote: "Quote",
      invoice: "Invoice",
      purchase_order: "Purchase Order",
      field_report: "Field Report",
    };
    return labels[type] || type;
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.document_type]) {
      acc[template.document_type] = [];
    }
    acc[template.document_type].push(template);
    return acc;
  }, {} as Record<string, PDFTemplate[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PDF Templates</h3>
          <p className="text-sm text-muted-foreground">Manage visual PDF templates with custom designs and data fields</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRegenerateAll}
            disabled={regenerating || templates.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
            Regenerate All
          </Button>
          <Button onClick={() => navigate("/template-builder")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No PDF templates yet</p>
          <Button onClick={() => navigate("/template-builder")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([docType, typeTemplates]) => (
            <div key={docType}>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                {getDocumentTypeLabel(docType)}
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        {template.thumbnail_url ? (
                          <img
                            src={template.thumbnail_url}
                            alt={template.name}
                            className="w-16 h-20 object-cover rounded border border-border"
                          />
                        ) : (
                          <div className="w-16 h-20 bg-muted rounded border border-border flex items-center justify-center">
                            <FileImage className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        {template.is_default ? (
                          <Badge>Default</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultTemplate.mutate({ id: template.id, documentType: template.document_type })}
                          >
                            Set Default
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.template_image_url ? (
                          <Badge variant="secondary">Ready</Badge>
                        ) : (
                          <Badge variant="outline">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/template-builder/${template.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTemplateToDelete(template.id);
                              setDeleteDialogOpen(true);
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
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => templateToDelete && deleteTemplate.mutate(templateToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
