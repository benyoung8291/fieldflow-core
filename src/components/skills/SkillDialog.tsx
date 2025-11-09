import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface SkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId?: string;
}

export default function SkillDialog({ open, onOpenChange, skillId }: SkillDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    is_active: true,
  });

  useEffect(() => {
    if (open && skillId) {
      fetchSkill();
    } else if (open) {
      resetForm();
    }
  }, [open, skillId]);

  const fetchSkill = async () => {
    const { data, error } = await supabase
      .from("skills")
      .select("*")
      .eq("id", skillId)
      .single();

    if (error) {
      toast({ title: "Error fetching skill", variant: "destructive" });
    } else if (data) {
      setFormData({
        name: data.name || "",
        description: data.description || "",
        category: data.category || "",
        is_active: data.is_active ?? true,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const skillData = {
        ...formData,
        tenant_id: profile?.tenant_id,
      };

      if (skillId) {
        const { error } = await supabase
          .from("skills")
          .update(skillData)
          .eq("id", skillId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("skills")
          .insert([skillData]);
        if (error) throw error;
      }

      toast({
        title: skillId ? "Skill updated successfully" : "Skill created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving skill",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{skillId ? "Edit" : "Create"} Skill</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Skill Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Technical, Safety, Certification"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {skillId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
