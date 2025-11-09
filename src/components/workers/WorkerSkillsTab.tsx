import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface WorkerSkillsTabProps {
  workerId: string;
}

export default function WorkerSkillsTab({ workerId }: WorkerSkillsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    skill_id: "",
    proficiency_level: "beginner",
    date_acquired: "",
    notes: "",
  });

  const { data: workerSkills = [], isLoading } = useQuery({
    queryKey: ["worker-skills", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_skills")
        .select(`
          *,
          skill:skills(id, name, category)
        `)
        .eq("worker_id", workerId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: availableSkills = [] } = useQuery({
    queryKey: ["skills-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = async () => {
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
        worker_id: workerId,
        tenant_id: profile?.tenant_id,
        date_acquired: formData.date_acquired || null,
      };

      if (editingSkill) {
        const { error } = await supabase
          .from("worker_skills")
          .update(skillData)
          .eq("id", editingSkill.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_skills")
          .insert([skillData]);
        if (error) throw error;
      }

      toast({
        title: editingSkill ? "Skill updated" : "Skill added",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-skills", workerId] });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error saving skill",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("worker_skills")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({
        title: "Error deleting skill",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Skill removed" });
      queryClient.invalidateQueries({ queryKey: ["worker-skills", workerId] });
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({
      skill_id: "",
      proficiency_level: "beginner",
      date_acquired: "",
      notes: "",
    });
    setEditingSkill(null);
  };

  const openEdit = (skill: any) => {
    setEditingSkill(skill);
    setFormData({
      skill_id: skill.skill_id,
      proficiency_level: skill.proficiency_level || "beginner",
      date_acquired: skill.date_acquired || "",
      notes: skill.notes || "",
    });
    setDialogOpen(true);
  };

  const proficiencyColors: Record<string, string> = {
    beginner: "bg-gray-500",
    intermediate: "bg-blue-500",
    advanced: "bg-green-500",
    expert: "bg-purple-500",
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSkill ? "Edit" : "Add"} Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="skill_id">Skill *</Label>
              <Select
                value={formData.skill_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, skill_id: value })
                }
                disabled={!!editingSkill}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select skill" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill: any) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                      {skill.category && ` (${skill.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="proficiency_level">Proficiency Level</Label>
              <Select
                value={formData.proficiency_level}
                onValueChange={(value) =>
                  setFormData({ ...formData, proficiency_level: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date_acquired">Date Acquired</Label>
              <Input
                id="date_acquired"
                type="date"
                value={formData.date_acquired}
                onChange={(e) =>
                  setFormData({ ...formData, date_acquired: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.skill_id}>
                {editingSkill ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this skill from the worker?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Skills</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Skill
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : workerSkills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No skills added yet
            </div>
          ) : (
            <div className="space-y-3">
              {workerSkills.map((ws: any) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{ws.skill?.name}</div>
                    {ws.skill?.category && (
                      <div className="text-sm text-muted-foreground">
                        {ws.skill.category}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        className={proficiencyColors[ws.proficiency_level]}
                      >
                        {ws.proficiency_level}
                      </Badge>
                      {ws.date_acquired && (
                        <span className="text-xs text-muted-foreground">
                          Acquired: {format(new Date(ws.date_acquired), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    {ws.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {ws.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(ws)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(ws.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
