import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectTasksGridProps {
  projectId: string;
}

interface Task {
  id?: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  progress_percentage: number;
  estimated_hours: number;
  linked_line_items: string[];
}

export default function ProjectTasksGrid({ projectId }: ProjectTasksGridProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tenantId, setTenantId] = useState<string>("");

  useEffect(() => {
    const fetchTenantId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (profile) setTenantId(profile.tenant_id);
      }
    };
    fetchTenantId();
  }, []);

  const { data: lineItems } = useQuery({
    queryKey: ["project-line-items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_line_items" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("item_order");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingTasks, refetch } = useQuery({
    queryKey: ["project-tasks-grid", projectId],
    queryFn: async () => {
      const { data: tasksData, error: tasksError } = await supabase
        .from("project_tasks" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("start_date");

      if (tasksError) throw tasksError;

      // Fetch linked line items for each task
      const tasksWithLinks = await Promise.all((tasksData || []).map(async (task: any) => {
        const { data: links } = await supabase
          .from("project_task_line_items" as any)
          .select("line_item_id")
          .eq("project_task_id", task.id);

        return {
          ...task,
          linked_line_items: links?.map((l: any) => l.line_item_id) || [],
        };
      }));

      return tasksWithLinks;
    },
  });

  useEffect(() => {
    if (existingTasks) {
      setTasks([...existingTasks, createEmptyTask()]);
    } else {
      setTasks([createEmptyTask()]);
    }
  }, [existingTasks]);

  const createEmptyTask = (): Task => ({
    title: "",
    start_date: "",
    end_date: "",
    status: "not_started",
    progress_percentage: 0,
    estimated_hours: 0,
    linked_line_items: [],
  });

  const updateTask = (index: number, field: keyof Task, value: any) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);

    // Auto-add new row if editing last row
    if (index === tasks.length - 1 && updated[index].title) {
      setTasks([...updated, createEmptyTask()]);
    }
  };

  const saveTask = async (index: number) => {
    const task = tasks[index];
    if (!task.title || !task.start_date || !task.end_date) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const taskData = {
        tenant_id: tenantId,
        project_id: projectId,
        title: task.title,
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status,
        progress_percentage: task.progress_percentage,
        estimated_hours: task.estimated_hours,
        created_by: user.id,
      };

      if (task.id) {
        // Update
        const { error } = await supabase
          .from("project_tasks" as any)
          .update(taskData)
          .eq("id", task.id);

        if (error) throw error;

        // Update line item links
        await supabase
          .from("project_task_line_items" as any)
          .delete()
          .eq("project_task_id", task.id);

        if (task.linked_line_items.length > 0) {
          await supabase
            .from("project_task_line_items" as any)
            .insert(
              task.linked_line_items.map((lineItemId) => ({
                tenant_id: tenantId,
                project_task_id: task.id,
                line_item_id: lineItemId,
              }))
            );
        }
      } else {
        // Create
        const { data: newTask, error } = await supabase
          .from("project_tasks" as any)
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;

        if (task.linked_line_items.length > 0) {
          await supabase
            .from("project_task_line_items" as any)
            .insert(
              task.linked_line_items.map((lineItemId) => ({
                tenant_id: tenantId,
                project_task_id: (newTask as any).id,
                line_item_id: lineItemId,
              }))
            );
        }
      }

      toast({ title: "Success", description: "Task saved" });
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteTask = async (index: number) => {
    const task = tasks[index];
    if (!task.id) {
      setTasks(tasks.filter((_, i) => i !== index));
      return;
    }

    try {
      await supabase.from("project_tasks" as any).delete().eq("id", task.id);
      toast({ title: "Success", description: "Task deleted" });
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleLineItem = (taskIndex: number, lineItemId: string) => {
    const updated = [...tasks];
    const current = updated[taskIndex].linked_line_items;
    if (current.includes(lineItemId)) {
      updated[taskIndex].linked_line_items = current.filter(id => id !== lineItemId);
    } else {
      updated[taskIndex].linked_line_items = [...current, lineItemId];
    }
    setTasks(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Tasks</CardTitle>
        <p className="text-sm text-muted-foreground">Excel-like grid - start typing to add tasks</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left text-sm font-medium w-[200px]">Task Name</th>
                <th className="p-2 text-left text-sm font-medium w-[120px]">Start Date</th>
                <th className="p-2 text-left text-sm font-medium w-[120px]">End Date</th>
                <th className="p-2 text-left text-sm font-medium w-[120px]">Status</th>
                <th className="p-2 text-left text-sm font-medium w-[100px]">Progress %</th>
                <th className="p-2 text-left text-sm font-medium w-[100px]">Est. Hours</th>
                <th className="p-2 text-left text-sm font-medium w-[200px]">Linked Line Items</th>
                <th className="p-2 text-center text-sm font-medium w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="p-1">
                    <Input
                      value={task.title}
                      onChange={(e) => updateTask(index, "title", e.target.value)}
                      placeholder="Task name..."
                      className="h-8"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="date"
                      value={task.start_date}
                      onChange={(e) => updateTask(index, "start_date", e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="date"
                      value={task.end_date}
                      onChange={(e) => updateTask(index, "end_date", e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="p-1">
                    <Select value={task.status} onValueChange={(v) => updateTask(index, "status", v)}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={task.progress_percentage}
                      onChange={(e) => updateTask(index, "progress_percentage", parseInt(e.target.value) || 0)}
                      className="h-8"
                      min="0"
                      max="100"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={task.estimated_hours}
                      onChange={(e) => updateTask(index, "estimated_hours", parseFloat(e.target.value) || 0)}
                      className="h-8"
                      step="0.5"
                    />
                  </td>
                  <td className="p-1">
                    <Select 
                      value={task.linked_line_items[0] || ""} 
                      onValueChange={(v) => updateTask(index, "linked_line_items", [v])}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select item..." />
                      </SelectTrigger>
                      <SelectContent>
                      {((lineItems as any) || []).map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.parent_line_item_id ? "  └ " : ""}{item.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1">
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => saveTask(index)}>
                        <Save className="h-4 w-4" />
                      </Button>
                      {task.id && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deleteTask(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
