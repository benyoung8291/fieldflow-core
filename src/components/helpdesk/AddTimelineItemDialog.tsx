import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, CheckSquare, ListTodo } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface AddTimelineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
}

export function AddTimelineItemDialog({ open, onOpenChange, ticketId }: AddTimelineItemDialogProps) {
  const [tab, setTab] = useState<"note" | "task" | "checklist">("note");
  const [noteContent, setNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [checklistItems, setChecklistItems] = useState<{ text: string; checked: boolean }[]>([{ text: "", checked: false }]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      let messageData: any = {
        ticket_id: ticketId,
        tenant_id: profile?.tenant_id,
        created_by: user?.id,
        sent_at: new Date().toISOString(),
      };

      if (tab === "note") {
        messageData.message_type = "note";
        messageData.body_text = noteContent;
        messageData.body = noteContent;
      } else if (tab === "task") {
        messageData.message_type = "task";
        messageData.subject = taskTitle;
        messageData.body_text = taskDescription;
        messageData.body = taskDescription;
      } else if (tab === "checklist") {
        messageData.message_type = "checklist";
        messageData.body = JSON.stringify(checklistItems);
        messageData.body_text = checklistItems.map(i => `${i.checked ? "[x]" : "[ ]"} ${i.text}`).join("\n");
      }

      const { error } = await supabase.from("helpdesk_messages").insert(messageData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Item added successfully" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-audit-logs", ticketId] });
      onOpenChange(false);
      setNoteContent("");
      setTaskTitle("");
      setTaskDescription("");
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
            <Textarea
              placeholder="Add your note here..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={6}
            />
          </TabsContent>

          <TabsContent value="task" className="space-y-3">
            <Input
              placeholder="Task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <Textarea
              placeholder="Task description (optional)"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={4}
            />
          </TabsContent>

          <TabsContent value="checklist" className="space-y-3">
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
