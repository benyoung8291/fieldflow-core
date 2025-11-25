import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { Badge } from "@/components/ui/badge";

interface HelpDeskPipelineUserAssignmentsProps {
  pipelineId: string;
}

export function HelpDeskPipelineUserAssignments({ pipelineId }: HelpDeskPipelineUserAssignmentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: assignedUsers } = useQuery({
    queryKey: ["helpdesk-pipeline-users", pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_pipeline_users" as any)
        .select(`
          id,
          user_id,
          profiles:user_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("pipeline_id", pipelineId);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", profile.tenant_id)
        .order("first_name");

      if (error) throw error;
      return data;
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("helpdesk_pipeline_users" as any)
        .insert({
          pipeline_id: pipelineId,
          user_id: userId,
          tenant_id: profile.tenant_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-pipeline-users", pipelineId] });
      toast({ title: "User added to pipeline" });
      setSelectedUserId("");
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("helpdesk_pipeline_users" as any)
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-pipeline-users", pipelineId] });
      toast({ title: "User removed from pipeline" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const availableUsers = allUsers?.filter(
    (user) => !assignedUsers?.some((au) => au.user_id === user.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Assigned Users</h4>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User to Pipeline</DialogTitle>
              <DialogDescription>
                Select a user to grant access to this pipeline
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <SelectWithSearch
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                options={
                  availableUsers?.map((user) => ({
                    label: `${user.first_name} ${user.last_name} (${user.email})`,
                    value: user.id,
                  })) || []
                }
                placeholder="Select a user"
                searchPlaceholder="Search users..."
                emptyText="No users available"
              />
              <Button
                onClick={() => selectedUserId && addUserMutation.mutate(selectedUserId)}
                disabled={!selectedUserId || addUserMutation.isPending}
                className="w-full"
              >
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {assignedUsers && assignedUsers.length > 0 ? (
          assignedUsers.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
            >
              <span className="text-sm">
                {assignment.profiles.first_name} {assignment.profiles.last_name}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeUserMutation.mutate(assignment.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No users assigned. All users can access this pipeline.
          </p>
        )}
      </div>
    </div>
  );
}
