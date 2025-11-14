import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MentionTextarea } from "./MentionTextarea";

interface InlineTaskEditorProps {
  onSave: (data: {
    title: string;
    description: string;
    priority: string;
    assigned_to?: string;
    due_date?: string;
    mentions?: string[];
  }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  defaultTitle?: string;
}

export function InlineTaskEditor({ onSave, onCancel, isSaving, defaultTitle }: InlineTaskEditorProps) {
  const [title, setTitle] = useState(defaultTitle || "");
  const [description, setDescription] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");

  const { data: users } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!title.trim()) return;
    
    await onSave({
      title,
      description,
      priority,
      assigned_to: (assignedTo && assignedTo !== "unassigned") ? assignedTo : undefined,
      due_date: dueDate || undefined,
      mentions,
    });
    
    setTitle("");
    setDescription("");
    setMentions([]);
    setPriority("medium");
    setAssignedTo("unassigned");
    setDueDate("");
  };

  return (
    <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-500">
        <CheckSquare className="h-4 w-4" />
        <span>Add Task</span>
        <span className="text-xs text-muted-foreground ml-2">(Use @ to mention users)</span>
      </div>
      
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Task Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title..."
            className="h-8"
            autoFocus
          />
        </div>

        <div>
          <Label className="text-xs">Description (Use @ to mention users)</Label>
          <MentionTextarea
            value={description}
            onChange={(value, userMentions) => {
              setDescription(value);
              setMentions(userMentions);
            }}
            placeholder="Add task details... Use @ to mention users"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
        >
          {isSaving ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </div>
  );
}
