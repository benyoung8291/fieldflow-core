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
import { Plus, Trash2, MessageSquare } from "lucide-react";

interface Template {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
}

export default function MessageTemplatesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    is_default: false,
  });
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["customer-message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_message_templates")
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

      const { error } = await supabase.from("customer_message_templates").insert({
        tenant_id: profile?.tenant_id,
        created_by: user.id,
        ...formData,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-message-templates"] });
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
        .from("customer_message_templates")
        .update(formData)
        .eq("id", selectedTemplate.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-message-templates"] });
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
        .from("customer_message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-message-templates"] });
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
      content: "",
      is_default: false,
    });
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
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
          <h3 className="text-lg font-semibold">Customer Message Templates</h3>
          <p className="text-sm text-muted-foreground">Pre-built messages for scope of works, inclusions, and exclusions</p>
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
              <TableHead>Preview</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {template.name}
                  </div>
                </TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {template.content}
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
              {selectedTemplate ? "Edit" : "Add"} Customer Message Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Introduction, Detailed Scope"
              />
            </div>

            <div>
              <Label htmlFor="content">Message Content *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Thank you for the opportunity to quote...

SCOPE OF WORKS:
- Item 1
- Item 2

INCLUSIONS:
- Included item 1
- Included item 2

EXCLUSIONS:
- Excluded item 1
- Excluded item 2

PRODUCTS:
- Product 1
- Product 2"
                rows={12}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_default">Set as Default</Label>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_default: checked })
                }
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