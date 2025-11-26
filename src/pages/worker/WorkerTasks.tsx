import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Clock, Calendar, AlertCircle, ChevronRight } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const statusConfig = {
  pending: {
    label: "To Do",
    icon: Circle,
    className: "text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "text-info",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-success",
  },
  cancelled: {
    label: "Cancelled",
    icon: Circle,
    className: "text-muted-foreground",
  },
};

const priorityConfig = {
  low: {
    label: "Low",
    className: "bg-muted text-muted-foreground border-muted",
  },
  medium: {
    label: "Medium",
    className: "bg-warning/20 text-warning border-warning/30",
  },
  high: {
    label: "High",
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
};

export default function WorkerTasks() {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["worker-tasks", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", currentUser.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: Database['public']['Enums']['task_status'] }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ 
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-tasks"] });
      toast.success("Task updated");
      setSelectedTask(null);
    },
    onError: () => {
      toast.error("Failed to update task");
    },
  });

  const handleMarkComplete = (taskId: string) => {
    updateTaskStatus.mutate({ taskId, status: 'completed' });
  };

  const handleMarkInProgress = (taskId: string) => {
    updateTaskStatus.mutate({ taskId, status: 'in_progress' });
  };

  const getDueDateLabel = (dueDate: string | null) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) {
      return { label: "Overdue", className: "text-destructive" };
    }
    if (isToday(date)) {
      return { label: "Due Today", className: "text-warning" };
    }
    if (isTomorrow(date)) {
      return { label: "Due Tomorrow", className: "text-info" };
    }
    return { label: format(date, "MMM d"), className: "text-muted-foreground" };
  };

  const groupedTasks = {
    overdue: tasks.filter((t: any) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== 'completed'),
    today: tasks.filter((t: any) => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'completed'),
    upcoming: tasks.filter((t: any) => (!t.due_date || (!isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)))) && t.status !== 'completed'),
    completed: tasks.filter((t: any) => t.status === 'completed'),
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-3 py-2.5">
          <h1 className="text-base font-semibold">My Tasks</h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="h-8 text-xs"
            >
              {showCompleted ? 'Hide' : 'Show'} Completed
            </Button>
            <Badge variant="outline" className="text-sm">
              {tasks.filter((t: any) => t.status !== 'completed').length}
            </Badge>
          </div>
        </div>

        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tasks assigned</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Overdue Tasks */}
            {groupedTasks.overdue.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <h2 className="text-sm font-semibold text-destructive">
                    Overdue ({groupedTasks.overdue.length})
                  </h2>
                </div>
              {groupedTasks.overdue.map((task: any) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={() => setSelectedTask(task)}
                  onMarkComplete={handleMarkComplete}
                  onMarkInProgress={handleMarkInProgress}
                  getDueDateLabel={getDueDateLabel}
                />
                ))}
              </div>
            )}

            {/* Today's Tasks */}
            {groupedTasks.today.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="h-4 w-4 text-warning" />
                  <h2 className="text-sm font-semibold">
                    Today ({groupedTasks.today.length})
                  </h2>
                </div>
              {groupedTasks.today.map((task: any) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={() => setSelectedTask(task)}
                  onMarkComplete={handleMarkComplete}
                  onMarkInProgress={handleMarkInProgress}
                  getDueDateLabel={getDueDateLabel}
                />
                ))}
              </div>
            )}

            {/* Upcoming Tasks */}
            {groupedTasks.upcoming.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-sm font-semibold px-1">
                  Upcoming ({groupedTasks.upcoming.length})
                </h2>
              {groupedTasks.upcoming.map((task: any) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={() => setSelectedTask(task)}
                  onMarkComplete={handleMarkComplete}
                  onMarkInProgress={handleMarkInProgress}
                  getDueDateLabel={getDueDateLabel}
                />
                ))}
              </div>
            )}

            {/* Completed Tasks */}
            {showCompleted && groupedTasks.completed.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-sm font-semibold text-muted-foreground px-1">
                  Completed ({groupedTasks.completed.length})
                </h2>
              {groupedTasks.completed.map((task: any) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={() => setSelectedTask(task)}
                  onMarkComplete={handleMarkComplete}
                  onMarkInProgress={handleMarkInProgress}
                  getDueDateLabel={getDueDateLabel}
                />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Details Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedTask && statusConfig[selectedTask.status as keyof typeof statusConfig] && (
                  <>
                    {(() => {
                      const StatusIcon = statusConfig[selectedTask.status as keyof typeof statusConfig].icon;
                      return <StatusIcon className={`h-5 w-5 ${statusConfig[selectedTask.status as keyof typeof statusConfig].className}`} />;
                    })()}
                    <span className={statusConfig[selectedTask.status as keyof typeof statusConfig].className}>
                      {statusConfig[selectedTask.status as keyof typeof statusConfig].label}
                    </span>
                  </>
                )}
                {selectedTask?.priority && (
                  <Badge variant="outline" className={priorityConfig[selectedTask.priority as keyof typeof priorityConfig].className}>
                    {priorityConfig[selectedTask.priority as keyof typeof priorityConfig].label}
                  </Badge>
                )}
              </div>

              {selectedTask?.description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {selectedTask?.due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Due: {format(new Date(selectedTask.due_date), "MMM d, yyyy")}</span>
                </div>
              )}

              {selectedTask?.estimated_hours && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Estimated: {selectedTask.estimated_hours}h</span>
                </div>
              )}

              {selectedTask?.tags && selectedTask.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTask.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {selectedTask?.status !== 'completed' && (
                <div className="flex gap-2 pt-4">
                  {selectedTask?.status !== 'in_progress' && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleMarkInProgress(selectedTask.id)}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                  )}
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleMarkComplete(selectedTask.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TaskCardProps {
  task: any;
  onSelect: () => void;
  onMarkComplete: (id: string) => void;
  onMarkInProgress: (id: string) => void;
  getDueDateLabel: (dueDate: string | null) => { label: string; className: string } | null;
}

function TaskCard({ task, onSelect, onMarkComplete, onMarkInProgress, getDueDateLabel }: TaskCardProps) {
  const statusInfo = statusConfig[task.status as keyof typeof statusConfig];
  const priorityInfo = priorityConfig[task.priority as keyof typeof priorityConfig];
  const dueDateLabel = getDueDateLabel(task.due_date);
  const StatusIcon = statusInfo.icon;

  return (
    <Card 
      className="card-interactive"
      onClick={onSelect}
    >
      <CardContent className="p-3.5">
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (task.status === 'completed') {
                onMarkInProgress(task.id);
              } else {
                onMarkComplete(task.id);
              }
            }}
            className="mt-0.5"
          >
            <StatusIcon className={`h-5 w-5 ${statusInfo.className}`} />
          </button>

          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm mb-1 leading-tight ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </h3>

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {dueDateLabel && (
                <div className={`flex items-center gap-1 ${dueDateLabel.className}`}>
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{dueDateLabel.label}</span>
                </div>
              )}

              <Badge variant="outline" className={`${priorityInfo.className} text-[10px] h-5`}>
                {priorityInfo.label}
              </Badge>

              {task.estimated_hours && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{task.estimated_hours}h</span>
                </div>
              )}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
