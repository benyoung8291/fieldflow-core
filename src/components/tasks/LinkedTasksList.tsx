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
import { getModuleRoute, statusConfig, priorityConfig, isTaskOverdue } from "@/lib/taskUtils";
import { useTasks, useUpdateTaskStatus } from "@/hooks/useTasks";
import { useWorkersCache } from "@/hooks/useWorkersCache";

interface LinkedTasksListProps {
  linkedModule: string;
  linkedRecordId: string;
}

export default function LinkedTasksList({ linkedModule, linkedRecordId }: LinkedTasksListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Use centralized hooks
  const { data: tasks = [], isLoading } = useTasks({
    module: linkedModule,
    recordId: linkedRecordId,
    includeLinkedRecords: true,
    includeSubtaskCounts: false,
  });

  const { data: workers = [] } = useWorkersCache();
  const updateTaskMutation = useUpdateTaskStatus();

  // Map status and priority colors from centralized config
  const statusColors: Record<string, string> = Object.fromEntries(
    Object.entries(statusConfig).map(([key, value]) => [key, value.color])
  );

  const priorityColors: Record<string, string> = Object.fromEntries(
    Object.entries(priorityConfig).map(([key, value]) => [key, value.color])
  );

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
    assigned: workers.find((u: any) => u.id === task.assigned_to)
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
                  {task.start_date && task.end_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.start_date), "MMM d")} - {format(new Date(task.end_date), "MMM d, yyyy")}
                    </div>
                  )}
                  {task.estimated_hours && (
                    <div className="flex items-center gap-1">
                      <span>{task.estimated_hours}h estimated</span>
                    </div>
                  )}
                  {task.progress_percentage > 0 && (
                    <div className="flex items-center gap-1">
                      <span>{task.progress_percentage}% complete</span>
                    </div>
                  )}
                      {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                      {isTaskOverdue(task.due_date, task.status) && (
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
                      <span className="font-medium">{task.document_type || (task.linked_module.charAt(0).toUpperCase() + task.linked_module.slice(1).replace('_', ' '))}:</span>
                      <span>{task.linked_record_name}</span>
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
            start_date: selectedTask.start_date ? new Date(selectedTask.start_date) : undefined,
            end_date: selectedTask.end_date ? new Date(selectedTask.end_date) : undefined,
            estimated_hours: selectedTask.estimated_hours?.toString() || "",
            progress_percentage: selectedTask.progress_percentage?.toString() || "0",
          }}
          linkedModule={linkedModule}
          linkedRecordId={linkedRecordId}
          linkedRecordName={selectedTask.linked_record_name}
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
                start_date: data.start_date?.toISOString().split('T')[0] || null,
                end_date: data.end_date?.toISOString().split('T')[0] || null,
                estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
                progress_percentage: data.progress_percentage ? parseInt(data.progress_percentage) : 0,
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
