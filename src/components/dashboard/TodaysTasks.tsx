import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, Circle, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
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
        .lte("due_date", today) // Get today's and overdue tasks
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(20);

      if (error) throw error;
      
      // Sort: overdue first, then by priority
      const sortedTasks = (data as Task[]).sort((a, b) => {
        const aIsOverdue = isPast(startOfDay(new Date(a.due_date)));
        const bIsOverdue = isPast(startOfDay(new Date(b.due_date)));
        
        // Overdue tasks first
        if (aIsOverdue && !bIsOverdue) return -1;
        if (!aIsOverdue && bIsOverdue) return 1;
        
        // Then by priority
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - 
               priorityOrder[b.priority as keyof typeof priorityOrder];
      });
      
      return sortedTasks;
    },
  });

  const handleTaskClick = (task: Task) => {
    if (task.linked_module && task.linked_record_id) {
      const moduleRoutes: { [key: string]: string } = {
        "service_orders": "/service-orders",
        "quotes": "/quotes",
        "projects": "/projects",
        "invoices": "/invoices",
        "customers": "/customers",
      };
      
      const basePath = moduleRoutes[task.linked_module];
      if (basePath) {
        navigate(`${basePath}/${task.linked_record_id}`);
        return;
      }
    }
    
    navigate("/tasks");
  };

  const isOverdue = (dueDate: string) => {
    return isPast(startOfDay(new Date(dueDate))) && 
           format(new Date(dueDate), "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd");
  };

  const overdueTasks = tasks.filter(t => isOverdue(t.due_date));
  const todayTasks = tasks.filter(t => !isOverdue(t.due_date));
  const displayTasks = tasks.slice(0, 5);
  const hasMoreTasks = tasks.length > 5;

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
      {overdueTasks.length > 0 && (
        <div className="flex gap-1.5 mb-2">
          <Badge variant="destructive" className="text-[10px] gap-0.5">
            <AlertCircle className="h-2.5 w-2.5" />
            {overdueTasks.length} overdue
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {todayTasks.length} today
          </Badge>
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
              const taskIsOverdue = isOverdue(task.due_date);
              
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
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(task.due_date), "MMM d")}
                      </span>
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
