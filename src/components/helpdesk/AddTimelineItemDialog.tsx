import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, CheckSquare, ListTodo } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MentionTextarea } from "./MentionTextarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface AddTimelineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}

export function AddTimelineItemDialog({ open, onOpenChange, ticketId }: AddTimelineItemDialogProps) {
  const [tab, setTab] = useState<"note" | "task" | "checklist">("note");
  const [noteContent, setNoteContent] = useState("");
  const [noteMentions, setNoteMentions] = useState<string[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskMentions, setTaskMentions] = useState<string[]>([]);
  const [taskAssignedTo, setTaskAssignedTo] = useState<string>("");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [checklistAssignedTo, setChecklistAssignedTo] = useState<string>("");
  const [checklistItems, setChecklistItems] = useState<{ text: string; checked: boolean }[]>([{ text: "", checked: false }]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch workers/users for assignment
  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-assignment"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", profile?.tenant_id || "")
        .order("first_name");

      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      if (tab === "note") {
        // Notes don't create system tasks, just helpdesk messages
        let messageData: any = {
          ticket_id: ticketId,
          tenant_id: profile.tenant_id,
          created_by: user?.id,
          sent_at: new Date().toISOString(),
          message_type: "note",
          body_text: noteContent,
          body: noteContent,
        };

        if (noteMentions.length > 0) {
          messageData.metadata = { mentions: noteMentions };
        }

        const { error } = await supabase.from("helpdesk_messages").insert(messageData);
        if (error) throw error;
      } else if (tab === "task") {
        // Create a system task linked to the ticket
        const { data: newTask, error: taskError } = await supabase.from("tasks" as any).insert({
          tenant_id: profile.tenant_id,
          title: taskTitle,
          description: taskDescription,
          status: "pending",
          priority: "medium",
          assigned_to: taskAssignedTo || null,
          created_by: user?.id,
          linked_module: "helpdesk_ticket",
          linked_record_id: ticketId,
        }).select("id").single();

        if (taskError) throw taskError;

        // Also create helpdesk message to track it in timeline
        const messageData: any = {
          ticket_id: ticketId,
          tenant_id: profile.tenant_id,
          created_by: user?.id,
          sent_at: new Date().toISOString(),
          message_type: "task",
          subject: taskTitle,
          body_text: taskDescription,
          body: taskDescription,
          metadata: { 
            task_id: (newTask as any).id,
            mentions: taskMentions.length > 0 ? taskMentions : undefined
          },
        };

        const { error: msgError } = await supabase.from("helpdesk_messages").insert(messageData);
        if (msgError) throw msgError;
      } else if (tab === "checklist") {
        // Create a system task with checklist items
        const { data: newTask, error: taskError } = await supabase.from("tasks" as any).insert({
          tenant_id: profile.tenant_id,
          title: checklistTitle,
          description: "Checklist task from helpdesk ticket",
          status: "pending",
          priority: "medium",
          assigned_to: checklistAssignedTo || null,
          created_by: user?.id,
          linked_module: "helpdesk_ticket",
          linked_record_id: ticketId,
        }).select("id").single();

        if (taskError) throw taskError;

        // Create checklist items
        const checklistData = checklistItems
          .filter(item => item.text.trim())
          .map((item, index) => ({
            task_id: (newTask as any).id,
            title: item.text,
            is_completed: item.checked,
            item_order: index,
          }));
        
        if (checklistData.length > 0) {
          await supabase.from("task_checklist_items" as any).insert(checklistData);
        }

        // Create helpdesk message to track in timeline
        const messageData: any = {
          ticket_id: ticketId,
          tenant_id: profile.tenant_id,
          created_by: user?.id,
          sent_at: new Date().toISOString(),
          message_type: "checklist",
          subject: checklistTitle,
          body: JSON.stringify(checklistItems),
          body_text: checklistItems.map(i => `${i.checked ? "[x]" : "[ ]"} ${i.text}`).join("\n"),
          metadata: { task_id: (newTask as any).id },
        };

        const { error: msgError } = await supabase.from("helpdesk_messages").insert(messageData);
        if (msgError) throw msgError;
      }
    },
    onSuccess: () => {
      toast({ title: "Item added successfully" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-audit-logs", ticketId] });
      onOpenChange(false);
      setNoteContent("");
      setNoteMentions([]);
      setTaskTitle("");
      setTaskDescription("");
      setTaskMentions([]);
      setTaskAssignedTo("");
      setChecklistTitle("");
      setChecklistAssignedTo("");
      setChecklistItems([{ text: "", checked: false }]);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, { text: "", checked: false }]);
  };

  const updateChecklistItem = (index: number, text: string, checked: boolean) => {
    const updated = [...checklistItems];
    updated[index] = { text, checked };
    setChecklistItems(updated);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Timeline</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="note" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              Note
            </TabsTrigger>
            <TabsTrigger value="task" className="gap-1">
              <CheckSquare className="h-3 w-3" />
              Task
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1">
              <ListTodo className="h-3 w-3" />
              Checklist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="note" className="space-y-3">
            <MentionTextarea
              placeholder="Add your note here... (Use @ to mention users)"
              value={noteContent}
              onChange={(value, mentions) => {
                setNoteContent(value);
                setNoteMentions(mentions);
              }}
              rows={6}
            />
          </TabsContent>

          <TabsContent value="task" className="space-y-3">
            <Input
              placeholder="Task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <MentionTextarea
              placeholder="Task description (optional, use @ to mention users)"
              value={taskDescription}
              onChange={(value, mentions) => {
                setTaskDescription(value);
                setTaskMentions(mentions);
              }}
              rows={4}
            />
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={taskAssignedTo} onValueChange={setTaskAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="space-y-3">
            <Input
              placeholder="Checklist title"
              value={checklistTitle}
              onChange={(e) => setChecklistTitle(e.target.value)}
            />
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={checklistAssignedTo} onValueChange={setChecklistAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) => updateChecklistItem(index, item.text, checked as boolean)}
                  />
                  <Input
                    placeholder="Checklist item"
                    value={item.text}
                    onChange={(e) => updateChecklistItem(index, e.target.value, item.checked)}
                    className="flex-1"
                  />
                  {checklistItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChecklistItem(index)}
                      className="px-2"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addChecklistItem} className="w-full">
              Add Item
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
