import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface TaskDependenciesTabProps {
  taskId: string;
  projectId: string;
}

export default function TaskDependenciesTab({ taskId, projectId }: TaskDependenciesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>("");
  const [dependencyType, setDependencyType] = useState("finish_to_start");
  const [lagDays, setLagDays] = useState("0");
  const queryClient = useQueryClient();

  const { data: dependencies, isLoading } = useQuery({
    queryKey: ["task-dependencies", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_dependencies")
        .select(`
          *,
          depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)
        `)
        .eq("task_id", taskId);

      if (error) throw error;
      return data;
    },
  });

  const { data: availableTasks } = useQuery({
    queryKey: ["project-tasks-for-deps", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("id, title, status")
        .eq("linked_module", "project")
        .eq("linked_record_id", projectId)
        .neq("id", taskId)
        .order("title");

      if (error) throw error;
      return data || [];
    },
  });

  const addDependencyMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("task_dependencies").insert({
        tenant_id: profile.tenant_id,
        task_id: taskId,
        depends_on_task_id: selectedTask,
        dependency_type: dependencyType,
        lag_days: parseInt(lagDays) || 0,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Dependency added");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add dependency");
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      const { error } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("id", dependencyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-dependencies", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Dependency removed");
    },
    onError: () => {
      toast.error("Failed to remove dependency");
    },
  });

  const resetForm = () => {
    setSelectedTask("");
    setDependencyType("finish_to_start");
    setLagDays("0");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) {
      toast.error("Please select a task");
      return;
    }
    addDependencyMutation.mutate();
  };

  const dependencyTypeLabels: Record<string, string> = {
    finish_to_start: "Finish to Start (FS)",
    start_to_start: "Start to Start (SS)",
    finish_to_finish: "Finish to Finish (FF)",
    start_to_finish: "Start to Finish (SF)",
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading dependencies...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Task Dependencies</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Dependency
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Task Dependency</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>This task depends on *</Label>
                <Select value={selectedTask} onValueChange={setSelectedTask}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks?.map((task: any) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Dependency Type</Label>
                <Select value={dependencyType} onValueChange={setDependencyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finish_to_start">Finish to Start (FS)</SelectItem>
                    <SelectItem value="start_to_start">Start to Start (SS)</SelectItem>
                    <SelectItem value="finish_to_finish">Finish to Finish (FF)</SelectItem>
                    <SelectItem value="start_to_finish">Start to Finish (SF)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  FS: Task starts when dependency finishes
                </p>
              </div>

              <div>
                <Label>Lag Time (days)</Label>
                <Input
                  type="number"
                  value={lagDays}
                  onChange={(e) => setLagDays(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Positive for delay, negative for lead time
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addDependencyMutation.isPending}>
                  {addDependencyMutation.isPending ? "Adding..." : "Add Dependency"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {dependencies && dependencies.length > 0 ? (
        <div className="space-y-2">
          {dependencies.map((dep: any) => (
            <Card key={dep.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {dep.depends_on_task?.title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">
                      {dependencyTypeLabels[dep.dependency_type]}
                    </Badge>
                    {dep.lag_days !== 0 && (
                      <Badge variant="outline" className="text-xs">
                        {dep.lag_days > 0 ? '+' : ''}{dep.lag_days} days
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Remove this dependency?")) {
                        removeDependencyMutation.mutate(dep.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No dependencies set for this task
        </div>
      )}
    </div>
  );
}