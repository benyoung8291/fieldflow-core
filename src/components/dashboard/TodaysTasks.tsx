import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, Circle, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast, startOfDay, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getModuleRoute, isTaskOverdue, sortTasksByUrgency } from "@/lib/taskUtils";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  linked_module: string | null;
  linked_record_id: string | null;
}

const priorityColors = {
  urgent: "destructive",
  high: "warning",
  medium: "secondary",
  low: "outline",
};

export function TodaysTasks() {
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["todays-tasks", currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", currentUser!.id)
        .in("status", ["pending", "in_progress"])
        .or(`due_date.lte.${today},due_date.is.null`)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(30);

      if (error) throw error;
      
      // Use centralized sorting
      return sortTasksByUrgency(data as Task[]);
    },
  });

  const handleTaskClick = (task: Task) => {
    if (task.linked_module && task.linked_record_id) {
      const route = getModuleRoute(task.linked_module, task.linked_record_id);
      if (route !== '#') {
        navigate(route);
        return;
      }
    }
    navigate("/tasks");
  };

  // Filter using centralized helper
  const overdueTasks = tasks.filter(t => t.due_date && isTaskOverdue(t.due_date, t.status));
  const todayTasks = tasks.filter(t => t.due_date && !isTaskOverdue(t.due_date, t.status));
  const noDateTasks = tasks.filter(t => !t.due_date);
  const displayTasks = tasks.slice(0, 7);
  const hasMoreTasks = tasks.length > 7;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {(overdueTasks.length > 0 || noDateTasks.length > 0) && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {overdueTasks.length > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              {overdueTasks.length} overdue
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {todayTasks.length} today
          </Badge>
          {noDateTasks.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {noDateTasks.length} no date
            </Badge>
          )}
        </div>
      )}
      {tasks.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-1 opacity-50" />
          <p>No pending tasks</p>
        </div>
      ) : (
        <div>
          <div className="space-y-2">
            {displayTasks.map((task) => {
              const taskIsOverdue = task.due_date ? isTaskOverdue(task.due_date, task.status) : false;
              
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className={`flex items-start gap-2 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer ${
                    taskIsOverdue 
                      ? 'bg-destructive/5 border border-destructive' 
                      : 'bg-muted/50 border border-border'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : taskIsOverdue ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${taskIsOverdue ? 'text-destructive' : ''}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <Badge
                        variant={priorityColors[task.priority as keyof typeof priorityColors] as any}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {task.priority}
                      </Badge>
                      {taskIsOverdue && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Overdue
                        </Badge>
                      )}
                      {task.due_date ? (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(task.due_date), "MMM d")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          No date
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMoreTasks && (
            <Button
              variant="link"
              onClick={() => navigate("/tasks")}
              className="w-full mt-3 text-xs"
            >
              View all {tasks.length} tasks →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
