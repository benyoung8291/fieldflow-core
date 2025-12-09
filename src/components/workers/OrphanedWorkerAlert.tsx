import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, UserPlus, Trash2 } from "lucide-react";
import { useOrphanedWorkerCheck } from "@/hooks/useOrphanedWorkerCheck";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OrphanedWorkerAlert() {
  const queryClient = useQueryClient();
  const { data: orphanedWorkers = [], isLoading, refetch } = useOrphanedWorkerCheck();
  const [selectedWorker, setSelectedWorker] = useState<{
    id: string;
    name: string;
    email: string | null;
  } | null>(null);
  const [dialogAction, setDialogAction] = useState<"fix" | "remove" | null>(null);

  const fixRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Get user's tenant_id from their profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Add worker role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "worker",
          tenant_id: profile.tenant_id,
        });

      if (roleError) throw roleError;
    },
    onSuccess: () => {
      toast.success("Worker role assigned successfully");
      queryClient.invalidateQueries({ queryKey: ["orphaned-workers"] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      setSelectedWorker(null);
      setDialogAction(null);
    },
    onError: (error) => {
      console.error("Failed to fix worker role:", error);
      toast.error("Failed to assign worker role");
    },
  });

  const removeWorkerMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Clear worker_state to remove from orphaned list
      const { error } = await supabase
        .from("profiles")
        .update({ worker_state: null })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Worker flag removed from profile");
      queryClient.invalidateQueries({ queryKey: ["orphaned-workers"] });
      setSelectedWorker(null);
      setDialogAction(null);
    },
    onError: (error) => {
      console.error("Failed to remove worker flag:", error);
      toast.error("Failed to update profile");
    },
  });

  if (isLoading || orphanedWorkers.length === 0) {
    return null;
  }

  return (
    <>
      <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Worker Role Assignment Issue Detected
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-6 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            {orphanedWorkers.length} user(s) were created as workers but don't have proper role
            assignment. This may prevent them from accessing the worker app.
          </p>
          <div className="space-y-2">
            {orphanedWorkers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center justify-between bg-background/50 rounded-md p-2"
              >
                <div>
                  <span className="font-medium">
                    {worker.first_name} {worker.last_name}
                  </span>
                  {worker.email && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({worker.email})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedWorker({
                        id: worker.id,
                        name: `${worker.first_name || ""} ${worker.last_name || ""}`.trim(),
                        email: worker.email,
                      });
                      setDialogAction("fix");
                    }}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Fix Role
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedWorker({
                        id: worker.id,
                        name: `${worker.first_name || ""} ${worker.last_name || ""}`.trim(),
                        email: worker.email,
                      });
                      setDialogAction("remove");
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <Dialog
        open={!!selectedWorker && !!dialogAction}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWorker(null);
            setDialogAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "fix" ? "Assign Worker Role" : "Dismiss Alert"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "fix" ? (
                <>
                  This will assign the worker role to{" "}
                  <strong>{selectedWorker?.name}</strong>
                  {selectedWorker?.email && ` (${selectedWorker.email})`}, allowing them
                  to access the worker app.
                </>
              ) : (
                <>
                  This will remove the worker flag from{" "}
                  <strong>{selectedWorker?.name}</strong>'s profile. They will no longer
                  appear in this alert but won't have worker app access unless you
                  manually add the role later.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedWorker(null);
                setDialogAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={dialogAction === "fix" ? "default" : "destructive"}
              onClick={() => {
                if (selectedWorker) {
                  if (dialogAction === "fix") {
                    fixRoleMutation.mutate(selectedWorker.id);
                  } else {
                    removeWorkerMutation.mutate(selectedWorker.id);
                  }
                }
              }}
              disabled={fixRoleMutation.isPending || removeWorkerMutation.isPending}
            >
              {fixRoleMutation.isPending || removeWorkerMutation.isPending
                ? "Processing..."
                : dialogAction === "fix"
                ? "Assign Role"
                : "Dismiss"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
