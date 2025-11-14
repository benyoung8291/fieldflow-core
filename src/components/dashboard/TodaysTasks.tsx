import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, Circle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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
        .eq("due_date", today)
        .in("status", ["pending", "in_progress"])
        .order("priority", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Task[];
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

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Today's Tasks
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
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Today's Tasks
          <Badge variant="secondary" className="ml-auto">
            {tasks.length} tasks
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No tasks due today</p>
            <p className="text-xs mt-1">You're all caught up!</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="mt-1">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant={priorityColors[task.priority as keyof typeof priorityColors] as any}
                        className="text-xs"
                      >
                        {task.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {task.status.replace("_", " ")}
                      </Badge>
                      {task.linked_module && (
                        <span className="text-xs text-muted-foreground">
                          {task.linked_module.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
