import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string;
  };
}

export function DeleteCustomerDialog({ open, onOpenChange, customer }: DeleteCustomerDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      navigate("/customers");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete customer: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (confirmText.toLowerCase() === "delete") {
      deleteMutation.mutate();
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onOpenChange(false);
  };

  const isConfirmValid = confirmText.toLowerCase() === "delete";

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Customer
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. This will permanently delete the customer account and all associated data.
              </AlertDescription>
            </Alert>

            <div>
              <p className="text-sm text-muted-foreground mb-4">
                You are about to delete: <span className="font-semibold text-foreground">{customer.name}</span>
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Type <span className="font-mono font-bold">delete</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type delete to confirm"
                  autoComplete="off"
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmValid || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Customer"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
