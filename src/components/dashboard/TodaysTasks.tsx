import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, Circle, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  if (isLoading) {
    return (
      <Card className="shadow-lg border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            My Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          My Tasks
          <div className="ml-auto flex gap-2">
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {overdueTasks.length} overdue
              </Badge>
            )}
            <Badge variant="secondary">
              {todayTasks.length} today
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No pending tasks</p>
            <p className="text-xs mt-1">You're all caught up!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {tasks.map((task) => {
                const taskIsOverdue = isOverdue(task.due_date);
                
                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={`flex items-start gap-3 p-4 rounded-lg hover:bg-muted transition-colors cursor-pointer ${
                      taskIsOverdue 
                        ? 'bg-destructive/5 border-2 border-destructive' 
                        : 'bg-muted/50 border border-border'
                    }`}
                  >
                    <div className="mt-1">
                      {task.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : taskIsOverdue ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${taskIsOverdue ? 'text-destructive' : ''}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge
                          variant={priorityColors[task.priority as keyof typeof priorityColors] as any}
                          className="text-xs"
                        >
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {task.status.replace("_", " ")}
                        </Badge>
                        {taskIsOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Due: {format(new Date(task.due_date), "MMM d")}
                        </span>
                        {task.linked_module && (
                          <span className="text-xs text-muted-foreground">
                            • {task.linked_module.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
