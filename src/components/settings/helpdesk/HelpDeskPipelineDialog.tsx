import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface HelpDeskPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: any;
}

const colorOptions = [
  { name: "Blue", value: "#0891B2" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Orange", value: "#F59E0B" },
  { name: "Red", value: "#EF4444" },
  { name: "Pink", value: "#EC4899" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Teal", value: "#14B8A6" },
];

export function HelpDeskPipelineDialog({
  open,
  onOpenChange,
  pipeline,
}: HelpDeskPipelineDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#0891B2",
    is_active: true,
    requires_assignment: true,
  });

  useEffect(() => {
    if (pipeline) {
      setFormData({
        name: pipeline.name || "",
        description: pipeline.description || "",
        color: pipeline.color || "#0891B2",
        is_active: pipeline.is_active ?? true,
        requires_assignment: pipeline.requires_assignment ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "#0891B2",
        is_active: true,
        requires_assignment: true,
      });
    }
  }, [pipeline, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      if (pipeline) {
        const { error } = await supabase
          .from("helpdesk_pipelines" as any)
          .update(formData)
          .eq("id", pipeline.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("helpdesk_pipelines" as any)
          .insert({
            ...formData,
            tenant_id: profile.tenant_id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-pipelines-settings"] });
      toast({
        title: pipeline ? "Pipeline updated successfully" : "Pipeline created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save pipeline",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pipeline ? "Edit Pipeline" : "Create Pipeline"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Pipeline Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Support, Sales, Technical..."
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this pipeline..."
              rows={3}
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: option.value })}
                  className={`h-10 rounded-md border-2 transition-all ${
                    formData.color === option.value
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted"
                  }`}
                  style={{ backgroundColor: option.value }}
                  title={option.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Inactive pipelines won't be available for new tickets
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requires_assignment">Requires Assignment</Label>
              <p className="text-sm text-muted-foreground">
                Tickets must be assigned to users (default view)
              </p>
            </div>
            <Switch
              id="requires_assignment"
              checked={formData.requires_assignment}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_assignment: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!formData.name || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : pipeline ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
