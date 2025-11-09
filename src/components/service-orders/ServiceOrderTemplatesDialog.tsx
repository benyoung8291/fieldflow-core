import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  name: string;
  description: string;
  skill_required: string;
  is_active: boolean;
}

interface ServiceOrderTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: string) => void;
}

export default function ServiceOrderTemplatesDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: ServiceOrderTemplatesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    skill_required: "",
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["service-order-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_templates" as any)
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Template[];
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.from("service_order_templates" as any).insert([{
        tenant_id: profile?.tenant_id,
        name: formData.name,
        description: formData.description,
        skill_required: formData.skill_required || null,
        created_by: user.id,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-templates"] });
      toast({ title: "Template created successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating template", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return;

      const { error } = await supabase
        .from("service_order_templates" as any)
        .update({
          name: formData.name,
          description: formData.description,
          skill_required: formData.skill_required || null,
        })
        .eq("id", selectedTemplate.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-templates"] });
      toast({ title: "Template updated successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating template", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_order_templates" as any)
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting template", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", skill_required: "" });
    setIsEditing(false);
    setSelectedTemplate(null);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      skill_required: template.skill_required || "",
    });
    setIsEditing(true);
  };

  const handleSubmit = () => {
    if (selectedTemplate) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Service Order Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Form */}
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{isEditing ? "Edit Template" : "Create Template"}</h3>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Annual HVAC Maintenance"
                />
              </div>

              <div className="space-y-2">
                <Label>Skill Required</Label>
                <Input
                  value={formData.skill_required}
                  onChange={(e) => setFormData({ ...formData, skill_required: e.target.value })}
                  placeholder="e.g., HVAC Technician"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Template description..."
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={!formData.name}>
              {isEditing ? "Update Template" : "Create Template"}
            </Button>
          </div>

          {/* Templates List */}
          <div className="space-y-4">
            <h3 className="font-semibold">Available Templates</h3>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates available. Create your first template above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Skill Required</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        {template.skill_required ? (
                          <Badge variant="outline">{template.skill_required}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {template.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onSelectTemplate(template.id);
                              onOpenChange(false);
                            }}
                          >
                            Use Template
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this template?")) {
                                deleteMutation.mutate(template.id);
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
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
