import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, CheckSquare, Mail, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import TaskDialog, { TaskFormData } from "@/components/tasks/TaskDialog";

interface ThreadSummaryCardProps {
  ticketId: string;
}

export function ThreadSummaryCard({ ticketId }: ThreadSummaryCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{ action: string; priority: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ["ticket-thread-summary", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("summarize-ticket-thread", {
        body: { ticketId },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: TaskFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data: task, error: taskError } = await (supabase as any)
        .from("tasks")
        .insert({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          assigned_to: taskData.assigned_to,
          due_date: taskData.due_date,
          tenant_id: profile.tenant_id,
          created_by: user.id,
          linked_module: "helpdesk",
          linked_record_id: ticketId,
          status: taskData.status || "pending",
        })
        .select()
        .single();
      
      if (taskError) throw taskError;

      const { error: messageError } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: ticketId,
          message_type: "task",
          body: `Task created: ${taskData.title}`,
          tenant_id: profile.tenant_id,
        });
      
      if (messageError) throw messageError;

      return task;
    },
    onSuccess: () => {
      toast({ title: "Task created successfully" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
      setTaskDialogOpen(false);
      setSelectedAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTask = (action: any) => {
    if (action.type !== "task") {
      toast({
        title: "Only task actions can be converted to tasks",
        variant: "destructive",
      });
      return;
    }
    setSelectedAction({ action: action.action, priority: action.priority });
    setTaskDialogOpen(true);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      case "medium":
        return <TrendingUp className="h-3.5 w-3.5 text-yellow-500" />;
      default:
        return <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "reply":
        return <Mail className="h-3.5 w-3.5" />;
      case "task":
        return <CheckSquare className="h-3.5 w-3.5" />;
      case "follow-up":
        return <TrendingUp className="h-3.5 w-3.5" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted/50 animate-pulse rounded" />
          </div>
        </div>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
      
      <div className="relative p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/15 shrink-0 shadow-sm">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                AI Thread Summary
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                  Auto-generated
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground">Based on email conversation</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/10"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Summary Text */}
        <div className="space-y-2 p-3 rounded-lg bg-background/80 backdrop-blur-sm border border-primary/10">
          <p className="text-sm text-foreground leading-relaxed">{summary.summary}</p>
          {summary.currentStatus && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Current Status:</p>
              <p className="text-xs text-foreground">{summary.currentStatus}</p>
            </div>
          )}
        </div>

        {/* Suggested Actions */}
        {summary.suggestedActions && summary.suggestedActions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Suggested Actions
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-2">
                {summary.suggestedActions.map((action: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleCreateTask(action)}
                    className="group p-3 rounded-lg bg-background/60 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex items-center justify-center h-6 w-6 rounded-md bg-background shrink-0 mt-0.5">
                        {getTypeIcon(action.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-foreground leading-snug">
                            {action.action}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {getPriorityIcon(action.priority)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={action.priority === "high" ? "destructive" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {action.priority}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                            {action.type}
                          </Badge>
                          {action.type === "task" && (
                            <span className="text-[10px] text-muted-foreground group-hover:text-primary">
                              Click to create
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Task Dialog */}
      {selectedAction && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          onSubmit={createTaskMutation.mutate}
          defaultValues={{
            title: selectedAction.action,
            description: "Task created from AI suggestion",
            priority: selectedAction.priority,
            status: "pending",
          }}
          linkedModule="helpdesk"
          linkedRecordId={ticketId}
          workers={workers}
        />
      )}
    </Card>
  );
}
