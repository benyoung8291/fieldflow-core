import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Play, Power, PowerOff, Zap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

export default function Workflows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // @ts-ignore - types will be auto-generated after migration
      const { data, error } = await (supabase as any)
        .from("workflows")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      // @ts-ignore - types will be auto-generated after migration
      const { error } = await (supabase as any)
        .from("workflows")
        .update({ is_active: !isActive } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // @ts-ignore - types will be auto-generated after migration
      const { error } = await supabase.from("workflows").delete().eq("id", id) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow deleted");
      setDeleteWorkflowId(null);
    },
  });

  const getTriggerLabel = (triggerType: string) => {
    const labels: Record<string, string> = {
      quote_created: "Quote Created",
      quote_approved: "Quote Approved",
      quote_sent: "Quote Sent",
      invoice_sent: "Invoice Sent",
      service_order_completed: "Service Order Completed",
      project_created: "Project Created",
    };
    return labels[triggerType] || triggerType;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Automation</h1>
          <p className="text-muted-foreground mt-1">
            Create automated workflows to streamline your business processes
          </p>
        </div>
        <Button onClick={() => navigate("/workflows/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading workflows...</div>
      ) : workflows && workflows.length > 0 ? (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{workflow.name}</CardTitle>
                      {workflow.is_system_default && (
                        <Badge variant="secondary">
                          <Zap className="h-3 w-3 mr-1" />
                          System Default
                        </Badge>
                      )}
                      <Badge variant={workflow.is_active ? "default" : "secondary"}>
                        {workflow.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>{workflow.description || "No description"}</CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="font-normal">
                        Trigger: {getTriggerLabel(workflow.trigger_type)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={workflow.is_active}
                      onCheckedChange={() =>
                        toggleActiveMutation.mutate({
                          id: workflow.id,
                          isActive: workflow.is_active,
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/workflows/${workflow.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!workflow.is_system_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteWorkflowId(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first workflow to automate your business processes
            </p>
            <Button onClick={() => navigate("/workflows/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteWorkflowId} onOpenChange={() => setDeleteWorkflowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWorkflowId && deleteMutation.mutate(deleteWorkflowId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
