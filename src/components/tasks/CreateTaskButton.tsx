import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";
import TaskDialog, { TaskFormData } from "./TaskDialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateTaskButtonProps {
  linkedModule?: string;
  linkedRecordId?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function CreateTaskButton({
  linkedModule,
  linkedRecordId,
  variant = "outline",
  size = "default",
}: CreateTaskButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [linkedRecordName, setLinkedRecordName] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch linked record name
  const { data: linkedRecord } = useQuery({
    queryKey: ["linked-record", linkedModule, linkedRecordId],
    queryFn: async () => {
      if (!linkedModule || !linkedRecordId) return null;
      
      const tableName = linkedModule === 'customer' ? 'customers' : 
                       linkedModule === 'lead' ? 'leads' :
                       linkedModule === 'project' ? 'projects' :
                       linkedModule === 'quote' ? 'quotes' : 
                       linkedModule;
      
      const { data, error } = await supabase
        .from(tableName as any)
        .select('name, title')
        .eq('id', linkedRecordId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!linkedModule && !!linkedRecordId,
  });

  useEffect(() => {
    if (linkedRecord) {
      setLinkedRecordName((linkedRecord as any)?.name || (linkedRecord as any)?.title || null);
    }
  }, [linkedRecord]);

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

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: TaskFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data: newTask, error } = await supabase.from("tasks" as any).insert({
        tenant_id: profile.tenant_id,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        assigned_to: taskData.assigned_to || null,
        due_date: taskData.due_date?.toISOString() || null,
        start_date: taskData.start_date?.toISOString().split('T')[0] || null,
        end_date: taskData.end_date?.toISOString().split('T')[0] || null,
        estimated_hours: taskData.estimated_hours ? parseFloat(taskData.estimated_hours) : null,
        progress_percentage: taskData.progress_percentage ? parseInt(taskData.progress_percentage) : 0,
        show_description_on_card: taskData.show_description_on_card || false,
        created_by: user.id,
        linked_module: linkedModule || null,
        linked_record_id: linkedRecordId || null,
      }).select().single();

      if (error) throw error;
      
      // Create notification for assigned user
      if (taskData.assigned_to && taskData.assigned_to !== user.id) {
        const assignerName = `${profile.first_name} ${profile.last_name}`.trim();
        await supabase.from("notifications" as any).insert({
          tenant_id: profile.tenant_id,
          user_id: taskData.assigned_to,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `${assignerName} assigned you the task: ${taskData.title}`,
          link: `/tasks`,
          metadata: {
            task_id: (newTask as any).id,
            assigner_id: user.id,
            assigner_name: assignerName,
          },
        });
      }

      // Apply checklist items if provided
      const checklistItems = (taskData as any)._checklistItems;
      if (checklistItems && checklistItems.length > 0 && newTask) {
        const checklistData = checklistItems.map((item: any) => ({
          task_id: (newTask as any).id,
          title: item.title,
          item_order: item.item_order,
        }));
        
        await supabase.from("task_checklist_items" as any).insert(checklistData);
      }
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

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
      >
        <CheckSquare className="h-4 w-4 mr-2" />
        Create Task
      </Button>

      <TaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={(data) => createTaskMutation.mutate(data)}
        linkedModule={linkedModule}
        linkedRecordId={linkedRecordId}
        linkedRecordName={linkedRecordName || undefined}
        workers={workers}
      />
    </>
  );
}
