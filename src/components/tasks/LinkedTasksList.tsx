import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TaskDialog, { TaskFormData } from "./TaskDialog";

interface LinkedTasksListProps {
  linkedModule: string;
  linkedRecordId: string;
}

export default function LinkedTasksList({ linkedModule, linkedRecordId }: LinkedTasksListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getModuleRoute = (module: string, id: string) => {
    const routes: Record<string, string> = {
      customer: `/customers/${id}`,
      lead: `/leads/${id}`,
      project: `/projects/${id}`,
      quote: `/quotes/${id}`,
      service_order: `/service-orders/${id}`,
    };
    return routes[module] || '#';
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", linkedModule, linkedRecordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("linked_module", linkedModule)
        .eq("linked_record_id", linkedRecordId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      
      // Fetch linked record names
      const tasksWithLinks = await Promise.all((data || []).map(async (task: any) => {
        if (!task.linked_module || !task.linked_record_id) return task;
        
        let linkedRecordName = null;
        try {
          const { data: linkedData } = await supabase
            .from(task.linked_module === 'customer' ? 'customers' : 
                  task.linked_module === 'lead' ? 'leads' :
                  task.linked_module === 'project' ? 'projects' :
                  task.linked_module === 'quote' ? 'quotes' : 
                  task.linked_module)
            .select('name, title')
            .eq('id', task.linked_record_id)
            .maybeSingle();
          
          if (linkedData) {
            linkedRecordName = (linkedData as any)?.name || (linkedData as any)?.title || null;
          }
        } catch (e) {
          console.error('Error fetching linked record:', e);
        }
        
        return { ...task, linked_record_name: linkedRecordName };
      }));
      
      return tasksWithLinks;
    },
  });

  // Fetch assigned user data separately
  const { data: assignedUsers = [] } = useQuery({
    queryKey: ["assigned-users", tasks.map((t: any) => t?.assigned_to).filter(Boolean)],
    queryFn: async () => {
      const userIds = [...new Set(tasks.map((t: any) => t?.assigned_to).filter(Boolean))];
      if (userIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: tasks.length > 0,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase
        .from("tasks" as any)
        .update({ status })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated");
    },
    onError: () => {
      toast.error("Failed to update task");
    },
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    in_progress: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const priorityColors: Record<string, string> = {
    low: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    medium: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    urgent: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">Loading tasks...</p>
        </CardContent>
      </Card>
    );
  }

  // Merge assigned user data with tasks
  const tasksWithAssigned = tasks.map((task: any) => ({
    ...task,
    assigned: assignedUsers.find((u: any) => u.id === task.assigned_to)
  }));

  if (tasksWithAssigned.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Linked Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No tasks linked to this record</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Linked Tasks ({tasksWithAssigned.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasksWithAssigned.map((task: any) => (
            <div
              key={task.id}
              className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedTask(task);
                setIsDialogOpen(true);
              }}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{task.title}</p>
                  <Badge variant="outline" className={statusColors[task.status]}>
                    {task.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline" className={priorityColors[task.priority]}>
                    {task.priority}
                  </Badge>
                </div>
                
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {task.assigned && (
                    <div className="flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      {task.assigned.first_name} {task.assigned.last_name}
                    </div>
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.due_date), "MMM d, yyyy")}
                      {new Date(task.due_date) < new Date() && task.status !== "completed" && (
                        <AlertCircle className="h-3 w-3 text-red-500 ml-1" />
                      )}
                    </div>
                  )}
                  {task.linked_module && task.linked_record_id && task.linked_record_name && (
                    <div 
                      className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(getModuleRoute(task.linked_module, task.linked_record_id));
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Linked to: {task.linked_module.charAt(0).toUpperCase() + task.linked_module.slice(1).replace('_', ' ')} - {task.linked_record_name}
                    </div>
                  )}
                </div>
              </div>

              {task.status !== "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTaskMutation.mutate({ taskId: task.id, status: "completed" });
                  }}
                >
                  Mark Complete
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedTask && (
        <TaskDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          taskId={selectedTask.id}
          defaultValues={{
            title: selectedTask.title,
            description: selectedTask.description || "",
            status: selectedTask.status,
            priority: selectedTask.priority,
            assigned_to: selectedTask.assigned_to || undefined,
            due_date: selectedTask.due_date ? new Date(selectedTask.due_date) : undefined,
          }}
          linkedModule={linkedModule}
          linkedRecordId={linkedRecordId}
          workers={workers}
          onSubmit={async (data: TaskFormData) => {
            const { error } = await supabase
              .from("tasks" as any)
              .update({
                title: data.title,
                description: data.description,
                status: data.status,
                priority: data.priority,
                assigned_to: data.assigned_to || null,
                due_date: data.due_date?.toISOString() || null,
              })
              .eq("id", selectedTask.id);

            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            toast.success("Task updated");
            setIsDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
