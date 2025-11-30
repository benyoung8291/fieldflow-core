import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeProjectStatus } from "@/lib/taskUtils";

export interface ProjectTask {
  id: string;
  title: string;
  name?: string; // For Gantt compatibility
  start_date: string;
  end_date: string;
  status: string;
  normalizedStatus: string; // Mapped to system task status
  progress_percentage: number;
  estimated_hours: number;
  linked_line_items?: string[];
}

export const useProjectTasks = (projectId: string, options?: { includeLineItems?: boolean }) => {
  const { includeLineItems = false } = options || {};

  return useQuery({
    queryKey: ["project-tasks", projectId, includeLineItems],
    queryFn: async () => {
      const { data: tasksData, error: tasksError } = await supabase
        .from("project_tasks" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("start_date");

      if (tasksError) throw tasksError;

      if (!tasksData) return [];

      // Optionally fetch linked line items
      const tasksWithLinks = await Promise.all(
        tasksData.map(async (task: any) => {
          let linked_line_items: string[] = [];

          if (includeLineItems) {
            const { data: links } = await supabase
              .from("project_task_line_items" as any)
              .select("line_item_id")
              .eq("task_id", task.id);

            linked_line_items = links?.map((l: any) => l.line_item_id) || [];
          }

          // Normalize the task for consistency
          return {
            ...task,
            name: task.title, // Add 'name' alias for Gantt chart compatibility
            normalizedStatus: normalizeProjectStatus(task.status),
            linked_line_items,
          };
        })
      );

      return tasksWithLinks as ProjectTask[];
    },
  });
};

// Hook for Gantt chart specific data
export const useProjectGanttData = (projectId: string) => {
  const { data: tasks = [] } = useProjectTasks(projectId);

  // Fetch dependencies
  const { data: dependencies = [] } = useQuery({
    queryKey: ["project-task-dependencies", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_task_dependencies" as any)
        .select("*")
        .in(
          "task_id",
          tasks.map((t) => t.id)
        );

      if (error) throw error;
      return data || [];
    },
    enabled: tasks.length > 0,
  });

  return { tasks, dependencies };
};
