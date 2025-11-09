import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

interface TaskChecklistProps {
  taskId: string;
}

export default function TaskChecklist({ taskId }: TaskChecklistProps) {
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");

  const { data: checklistItems = [] } = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklist_items" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("item_order");

      if (error) throw error;
      return data || [];
    },
    enabled: !!taskId,
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("task_checklist_items" as any)
        .update({
          is_completed: !isCompleted,
          completed_at: !isCompleted ? new Date().toISOString() : null,
          completed_by: !isCompleted ? user?.id : null,
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase
        .from("task_checklist_items" as any)
        .insert({
          task_id: taskId,
          title,
          item_order: checklistItems.length,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] });
      setNewItemTitle("");
      toast.success("Checklist item added");
    },
    onError: () => {
      toast.error("Failed to add item");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("task_checklist_items" as any)
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] });
      toast.success("Checklist item removed");
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemTitle.trim()) {
      addItemMutation.mutate(newItemTitle.trim());
    }
  };

  const completedCount = checklistItems.filter((item: any) => item.is_completed).length;
  const totalCount = checklistItems.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Checklist</h4>
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {completedCount} / {totalCount} completed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {checklistItems.map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={() => toggleItemMutation.mutate({ 
                itemId: item.id, 
                isCompleted: item.is_completed 
              })}
            />
            <span className={`flex-1 text-sm ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
              {item.title}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteItemMutation.mutate(item.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddItem} className="flex gap-2">
        <Input
          placeholder="Add checklist item..."
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!newItemTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
