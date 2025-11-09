import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  show_cost_analysis: boolean;
  show_sub_items: boolean;
  show_margins: boolean;
  header_text: string | null;
  footer_text: string | null;
  is_default: boolean;
}

export default function QuoteTemplatesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    show_cost_analysis: false,
    show_sub_items: true,
    show_margins: false,
    header_text: "",
    footer_text: "Thank you for your business!",
    is_default: false,
  });
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Template[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.from("quote_templates").insert({
        tenant_id: profile?.tenant_id,
        created_by: user.id,
        ...formData,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-templates"] });
      toast.success("Template created successfully");
      handleDialogClose();
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return;

      const { error } = await supabase
        .from("quote_templates")
        .update(formData)
        .eq("id", selectedTemplate.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-templates"] });
      toast.success("Template updated successfully");
      handleDialogClose();
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quote_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-templates"] });
      toast.success("Template deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedTemplate(null);
    setFormData({
      name: "",
      show_cost_analysis: false,
      show_sub_items: true,
      show_margins: false,
      header_text: "",
      footer_text: "Thank you for your business!",
      is_default: false,
    });
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      show_cost_analysis: template.show_cost_analysis,
      show_sub_items: template.show_sub_items,
      show_margins: template.show_margins,
      header_text: template.header_text || "",
      footer_text: template.footer_text || "Thank you for your business!",
      is_default: template.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (selectedTemplate) {
      updateTemplate.mutate();
    } else {
      createTemplate.mutate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PDF Templates</h3>
          <p className="text-sm text-muted-foreground">Customize how quotes appear when generated as PDF</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {template.name}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {template.show_cost_analysis && <Badge variant="secondary" className="text-xs">Cost Analysis</Badge>}
                    {template.show_margins && <Badge variant="secondary" className="text-xs">Margins</Badge>}
                    {template.show_sub_items && <Badge variant="secondary" className="text-xs">Sub-items</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={template.is_default ? "default" : "outline"}>
                    {template.is_default ? "Default" : "Available"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
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
                          deleteTemplate.mutate(template.id);
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit" : "Add"} PDF Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Quote, Detailed Quote"
              />
            </div>

            <div className="space-y-3">
              <Label>Display Options</Label>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_sub_items" className="font-normal">Show Sub-items</Label>
                <Switch
                  id="show_sub_items"
                  checked={formData.show_sub_items}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, show_sub_items: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_cost_analysis" className="font-normal">Show Cost Analysis</Label>
                <Switch
                  id="show_cost_analysis"
                  checked={formData.show_cost_analysis}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, show_cost_analysis: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_margins" className="font-normal">Show Margin Percentages</Label>
                <Switch
                  id="show_margins"
                  checked={formData.show_margins}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, show_margins: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_default" className="font-normal">Set as Default</Label>
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_default: checked })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="header_text">Header Text</Label>
              <Textarea
                id="header_text"
                value={formData.header_text}
                onChange={(e) =>
                  setFormData({ ...formData, header_text: e.target.value })
                }
                placeholder="Text to appear in the header of the quote"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="footer_text">Footer Text</Label>
              <Textarea
                id="footer_text"
                value={formData.footer_text}
                onChange={(e) =>
                  setFormData({ ...formData, footer_text: e.target.value })
                }
                placeholder="Text to appear in the footer of the quote"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {selectedTemplate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}