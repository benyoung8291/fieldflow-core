import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface TaskTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
}

export default function TaskTemplateDialog({
  open,
  onOpenChange,
  template,
}: TaskTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_priority: "medium",
    default_status: "pending",
    estimated_hours: "",
    is_active: true,
  });
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || "",
        description: template.description || "",
        default_priority: template.default_priority || "medium",
        default_status: template.default_status || "pending",
        estimated_hours: template.estimated_hours?.toString() || "",
        is_active: template.is_active ?? true,
      });
      setChecklistItems(
        template.checklist && template.checklist.length > 0
          ? template.checklist.sort((a: any, b: any) => a.item_order - b.item_order).map((item: any) => item.title)
          : [""]
      );
    } else {
      setFormData({
        name: "",
        description: "",
        default_priority: "medium",
        default_status: "pending",
        estimated_hours: "",
        is_active: true,
      });
      setChecklistItems([""]);
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const templateData = {
        tenant_id: profile.tenant_id,
        name: formData.name,
        description: formData.description || null,
        default_priority: formData.default_priority,
        default_status: formData.default_status,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        is_active: formData.is_active,
        created_by: user.id,
      };

      let templateId: string;

      if (template) {
        // Update existing template
        const { error } = await supabase
          .from("task_templates" as any)
          .update(templateData)
          .eq("id", template.id);

        if (error) throw error;
        templateId = template.id;

        // Delete old checklist items
        await supabase
          .from("task_template_checklist_items" as any)
          .delete()
          .eq("template_id", template.id);
      } else {
        // Create new template
        const { data: newTemplate, error } = await supabase
          .from("task_templates" as any)
          .insert(templateData)
          .select()
          .single();

        if (error) throw error;
        if (!newTemplate) throw new Error("Failed to create template");
        templateId = (newTemplate as any).id;
      }

      // Insert checklist items
      const validItems = checklistItems.filter(item => item.trim());
      if (validItems.length > 0) {
        const checklistData = validItems.map((title, index) => ({
          template_id: templateId,
          title,
          item_order: index,
        }));

        const { error } = await supabase
          .from("task_template_checklist_items" as any)
          .insert(checklistData);

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success(template ? "Template updated" : "Template created");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, ""]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    const updated = [...checklistItems];
    updated[index] = value;
    setChecklistItems(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Task Template" : "Create Task Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Customer Onboarding"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this template is for..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="default_priority">Default Priority</Label>
              <Select
                value={formData.default_priority}
                onValueChange={(value) => setFormData({ ...formData, default_priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="default_status">Default Status</Label>
              <Select
                value={formData.default_status}
                onValueChange={(value) => setFormData({ ...formData, default_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimated_hours">Estimated Hours</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active Template
            </Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Checklist Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateChecklistItem(index, e.target.value)}
                    placeholder={`Checklist item ${index + 1}`}
                  />
                  {checklistItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChecklistItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !formData.name.trim()}>
              {saving ? "Saving..." : template ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
