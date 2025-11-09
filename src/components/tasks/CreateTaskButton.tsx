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
        linked_module: linkedModule || null,
        linked_record_id: linkedRecordId || null,
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
