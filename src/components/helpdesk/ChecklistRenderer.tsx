import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ChecklistRendererProps {
  taskId: string;
  ticketNumber: string;
}

export function ChecklistRenderer({ taskId, ticketNumber }: ChecklistRendererProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: checklistItems = [] } = useQuery({
    queryKey: ["task-checklist-items", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklist_items" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("item_order");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: assignedUserName } = useQuery({
    queryKey: ["task-assigned-user", taskId],
    queryFn: async () => {
      const { data: taskData } = await supabase
        .from("tasks" as any)
        .select("assigned_to")
        .eq("id", taskId)
        .maybeSingle();

      if (!taskData || !(taskData as any).assigned_to) return null;

      const { data: userData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", (taskData as any).assigned_to)
        .maybeSingle();
      
      if (!userData) return null;
      return `${(userData as any).first_name || ""} ${(userData as any).last_name || ""}`.trim();
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("task_checklist_items" as any)
        .update({ is_completed: isCompleted })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist-items", taskId] });
    },
    onError: () => {
      toast({ title: "Failed to update checklist item", variant: "destructive" });
    },
  });

  const completedCount = checklistItems.filter((item: any) => item.is_completed).length;
  const totalCount = checklistItems.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {completedCount} of {totalCount} completed
          {assignedUserName && (
            <span className="ml-2">
              • Assigned to: {assignedUserName}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/tasks`)}
          className="h-6 text-xs gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          View Task
        </Button>
      </div>
      <div className="space-y-1.5">
        {checklistItems.map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={(checked) =>
                toggleItemMutation.mutate({ itemId: item.id, isCompleted: checked as boolean })
              }
            />
            <span className={item.is_completed ? "line-through text-muted-foreground" : ""}>
              {item.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
