import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Edit2, Check, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface ChecklistRendererProps {
  taskId: string;
  ticketNumber: string;
}

export function ChecklistRenderer({ taskId, ticketNumber }: ChecklistRendererProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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
      const firstName = (userData as any).first_name || "";
      const lastName = (userData as any).last_name || "";
      
      if (!firstName && !lastName) return null;
      return `${firstName} ${lastName}`.trim();
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

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("task_checklist_items" as any)
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist-items", taskId] });
      toast({ title: "Checklist item deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete checklist item", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, title }: { itemId: string; title: string }) => {
      const { error } = await supabase
        .from("task_checklist_items" as any)
        .update({ title })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist-items", taskId] });
      setEditingItemId(null);
      setEditingTitle("");
      toast({ title: "Checklist item updated" });
    },
    onError: () => {
      toast({ title: "Failed to update checklist item", variant: "destructive" });
    },
  });

  const startEditing = (itemId: string, currentTitle: string) => {
    setEditingItemId(itemId);
    setEditingTitle(currentTitle);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingTitle("");
  };

  const saveEdit = () => {
    if (editingItemId && editingTitle.trim()) {
      updateItemMutation.mutate({ itemId: editingItemId, title: editingTitle.trim() });
    }
  };

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
          <div key={item.id} className="flex items-center gap-2 text-sm group">
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={(checked) =>
                toggleItemMutation.mutate({ itemId: item.id, isCompleted: checked as boolean })
              }
              disabled={editingItemId === item.id}
            />
            {editingItemId === item.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEditing();
                  }}
                  className="h-7 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={saveEdit}
                  className="h-7 w-7 p-0"
                  disabled={!editingTitle.trim() || updateItemMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEditing}
                  className="h-7 w-7 p-0"
                  disabled={updateItemMutation.isPending}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <>
                <span className={item.is_completed ? "line-through text-muted-foreground flex-1" : "flex-1"}>
                  {item.title}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing(item.id, item.title)}
                    className="h-6 w-6 p-0"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    disabled={deleteItemMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
