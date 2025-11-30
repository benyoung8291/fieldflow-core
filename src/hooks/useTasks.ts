import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getModuleTableConfig, formatDocumentType } from "@/lib/taskUtils";

interface TaskFilters {
  status?: string;
  priority?: string;
  assigneeId?: string;
  module?: string;
  recordId?: string;
  searchQuery?: string;
}

interface UseTasksOptions extends TaskFilters {
  enabled?: boolean;
  includeSubtaskCounts?: boolean;
  includeLinkedRecords?: boolean;
}

export const useTasks = (options: UseTasksOptions = {}) => {
  const {
    status,
    priority,
    assigneeId,
    module,
    recordId,
    searchQuery,
    enabled = true,
    includeSubtaskCounts = true,
    includeLinkedRecords = true,
  } = options;

  return useQuery({
    queryKey: ["tasks", { status, priority, assigneeId, module, recordId, searchQuery }],
    queryFn: async () => {
      let query = supabase
        .from("tasks" as any)
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: false });

      // Apply filters
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (priority && priority !== "all") {
        query = query.eq("priority", priority);
      }
      if (assigneeId) {
        query = query.eq("assigned_to", assigneeId);
      }
      if (module) {
        query = query.eq("linked_module", module);
      }
      if (recordId) {
        query = query.eq("linked_record_id", recordId);
      }
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data) return [];

      // Fetch subtask counts in a single query
      let subtaskCountsMap = new Map<string, { total: number; completed: number }>();
      if (includeSubtaskCounts) {
        const taskIds = data.map((t: any) => t.id);
        if (taskIds.length > 0) {
          const { data: subtasks } = await supabase
            .from("tasks")
            .select("parent_task_id, status")
            .in("parent_task_id", taskIds);

          if (subtasks) {
            subtasks.forEach((st: any) => {
              const current = subtaskCountsMap.get(st.parent_task_id) || { total: 0, completed: 0 };
              current.total++;
              if (st.status === "completed") current.completed++;
              subtaskCountsMap.set(st.parent_task_id, current);
            });
          }
        }
      }

      // Fetch linked records
      const tasksWithData = await Promise.all(
        data.map(async (task: any) => {
          const subtaskData = subtaskCountsMap.get(task.id) || { total: 0, completed: 0 };

          if (!includeLinkedRecords || !task.linked_module || !task.linked_record_id) {
            return {
              ...task,
              subtaskCount: subtaskData.total,
              completedSubtaskCount: subtaskData.completed,
            };
          }

          try {
            const { tableName, nameField } = getModuleTableConfig(task.linked_module);
            const { data: linkedData } = await supabase
              .from(tableName as any)
              .select(nameField)
              .eq("id", task.linked_record_id)
              .maybeSingle();

            return {
              ...task,
              subtaskCount: subtaskData.total,
              completedSubtaskCount: subtaskData.completed,
              linked_record_name: linkedData ? (linkedData as any)[nameField] : null,
              document_type: formatDocumentType(task.linked_module),
            };
          } catch (error) {
            console.error("Error fetching linked record:", error);
            return {
              ...task,
              subtaskCount: subtaskData.total,
              completedSubtaskCount: subtaskData.completed,
              linked_record_name: null,
              document_type: formatDocumentType(task.linked_module),
            };
          }
        })
      );

      return tasksWithData;
    },
    enabled,
  });
};

// Hook for updating task status
export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase
        .from("tasks" as any)
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    },
  });
};

// Hook for current user's tasks
export const useMyTasks = (filters?: Omit<UseTasksOptions, 'assigneeId'>) => {
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  return useTasks({
    ...filters,
    assigneeId: currentUser?.id,
    enabled: !!currentUser?.id && (filters?.enabled !== false),
  });
};
