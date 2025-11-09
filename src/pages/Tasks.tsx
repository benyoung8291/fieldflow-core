import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Filter, Calendar, User, Link as LinkIcon, ExternalLink } from "lucide-react";
import TaskDialog, { TaskFormData } from "@/components/tasks/TaskDialog";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function Tasks() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("my-tasks");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

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

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
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

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", filterStatus, filterPriority, filterAssignee, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("tasks" as any)
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: false });

      // Filter by assignee (default: my tasks)
      if (filterAssignee === "my-tasks" && currentUser) {
        query = query.eq("assigned_to", currentUser.id);
      } else if (filterAssignee !== "all" && filterAssignee !== "my-tasks") {
        query = query.eq("assigned_to", filterAssignee);
      }

      // Filter by status
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Filter by priority
      if (filterPriority !== "all") {
        query = query.eq("priority", filterPriority);
      }

      // Search
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query;
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

  // Fetch assigned users data
  const { data: assignedUsersData = [] } = useQuery({
    queryKey: ["assigned-users-data", tasks.map((t: any) => t?.assigned_to).filter(Boolean)],
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

  // Merge assigned user data with tasks
  const tasksWithUsers = tasks.map((task: any) => ({
    ...task,
    assigned_user: assignedUsersData.find((u: any) => u.id === task.assigned_to)
  }));

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: TaskFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { error } = await supabase.from("tasks" as any).insert({
        tenant_id: profile.tenant_id,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        assigned_to: taskData.assigned_to || null,
        due_date: taskData.due_date?.toISOString() || null,
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to create task");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }) => {
      const { error } = await supabase
        .from("tasks" as any)
        .update({
          ...data,
          due_date: data.due_date?.toISOString() || null,
          completed_at: data.status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated successfully");
      setSelectedTask(null);
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to update task");
    },
  });

  const toggleTaskStatus = async (task: any) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskMutation.mutate({
      id: task.id,
      data: { status: newStatus } as any,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">Manage your to-do list and assignments</p>
          </div>
          <Button onClick={() => { setSelectedTask(null); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger>
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my-tasks">My Tasks</SelectItem>
                  <SelectItem value="all">All Tasks</SelectItem>
                  {workers.filter(w => w.id && w.id.trim()).map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setFilterStatus("all");
                  setFilterPriority("all");
                  setFilterAssignee("my-tasks");
                  setSearchQuery("");
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tasksWithUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No tasks found</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first task to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasksWithUsers.map((task: any) => (
              <Card
                key={task.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedTask(task);
                  setIsDialogOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleTaskStatus(task)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={getPriorityColor(task.priority)} variant="outline">
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "MMM d, yyyy")}
                          </div>
                        )}
                        {task.assigned_user && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assigned_user.first_name} {task.assigned_user.last_name}
                          </div>
                        )}
                        {task.linked_module && task.linked_record_name && (
                          <div 
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(getModuleRoute(task.linked_module, task.linked_record_id));
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {task.linked_module.charAt(0).toUpperCase() + task.linked_module.slice(1).replace('_', ' ')} - {task.linked_record_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TaskDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedTask(null);
        }}
        onSubmit={(data) => {
          if (selectedTask) {
            updateTaskMutation.mutate({ id: selectedTask.id, data });
          } else {
            createTaskMutation.mutate(data);
          }
        }}
        taskId={selectedTask?.id}
        defaultValues={selectedTask ? {
          title: selectedTask.title,
          description: selectedTask.description || "",
          status: selectedTask.status,
          priority: selectedTask.priority,
          assigned_to: selectedTask.assigned_to || undefined,
          due_date: selectedTask.due_date ? new Date(selectedTask.due_date) : undefined,
        } : undefined}
        linkedModule={selectedTask?.linked_module}
        linkedRecordId={selectedTask?.linked_record_id}
        workers={workers}
      />
    </DashboardLayout>
  );
}
