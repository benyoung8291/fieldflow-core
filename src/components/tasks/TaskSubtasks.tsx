import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Calendar as CalendarIcon, User, Trash2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TaskSubtasksProps {
  taskId?: string;
  parentTaskId?: string;
}

export default function TaskSubtasks({ taskId, parentTaskId }: TaskSubtasksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("unassigned");
  const [selectedDueDate, setSelectedDueDate] = useState<Date>();
  const queryClient = useQueryClient();

  // Fetch workers for assignee dropdown
  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-subtasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch subtasks
  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: ["subtasks", taskId || parentTaskId],
    queryFn: async () => {
      if (!taskId && !parentTaskId) return [];
      
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_user:profiles!tasks_assigned_to_fkey(id, first_name, last_name)
        `)
        .eq("parent_task_id", taskId || parentTaskId)
        .order("created_at");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!(taskId || parentTaskId),
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async () => {
      if (!newSubtaskTitle.trim()) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Get parent task depth
      let parentDepth = 0;
      if (taskId || parentTaskId) {
        const { data: parentTask } = await supabase
          .from("tasks")
          .select("depth_level")
          .eq("id", taskId || parentTaskId)
          .single();
        
        parentDepth = parentTask?.depth_level || 0;
      }

      const { error } = await supabase.from("tasks").insert({
        tenant_id: profile.tenant_id,
        title: newSubtaskTitle,
        status: "pending",
        priority: "medium",
        parent_task_id: taskId || parentTaskId,
        depth_level: parentDepth + 1,
        assigned_to: (selectedAssignee && selectedAssignee !== "unassigned") ? selectedAssignee : null,
        due_date: selectedDueDate?.toISOString() || null,
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Subtask created");
      setNewSubtaskTitle("");
      setSelectedAssignee("unassigned");
      setSelectedDueDate(undefined);
      setIsAdding(false);
    },
    onError: () => {
      toast.error("Failed to create subtask");
    },
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Subtask updated");
    },
    onError: () => {
      toast.error("Failed to update subtask");
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Subtask deleted");
    },
    onError: () => {
      toast.error("Failed to delete subtask");
    },
  });

  const toggleSubtaskStatus = (subtask: any) => {
    const newStatus = subtask.status === "completed" ? "pending" : "completed";
    updateSubtaskMutation.mutate({
      id: subtask.id,
      updates: {
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      },
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-destructive/80 text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!taskId && !parentTaskId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Save the task first to add subtasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Subtasks</h3>
          <p className="text-xs text-muted-foreground">
            Break down this task into smaller pieces
          </p>
        </div>
        {!isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subtask
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Input
              placeholder="Subtask title"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              autoFocus
            />
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Assignee</label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Due Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDueDate ? format(selectedDueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDueDate}
                      onSelect={setSelectedDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewSubtaskTitle("");
                  setSelectedAssignee("");
                  setSelectedDueDate(undefined);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createSubtaskMutation.mutate()}
                disabled={!newSubtaskTitle.trim()}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : subtasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No subtasks yet
        </div>
      ) : (
        <div className="space-y-2">
          {subtasks.map((subtask: any) => (
            <Card key={subtask.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={subtask.status === "completed"}
                    onCheckedChange={() => toggleSubtaskStatus(subtask)}
                    className="mt-0.5"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={cn(
                        "text-sm font-medium",
                        subtask.status === "completed" && "line-through text-muted-foreground"
                      )}>
                        {subtask.title}
                      </h4>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getPriorityColor(subtask.priority))}
                        >
                          {subtask.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {subtask.due_date && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(subtask.due_date), "MMM d")}
                        </div>
                      )}
                      
                      {subtask.assigned_user && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {subtask.assigned_user.first_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}