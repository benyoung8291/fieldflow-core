import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteTimeLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  workerName: string;
  clockIn: string;
}

export default function DeleteTimeLogDialog({
  open,
  onOpenChange,
  onConfirm,
  workerName,
  clockIn,
}: DeleteTimeLogDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const isValid = confirmText.toLowerCase() === "delete";

  const handleConfirm = () => {
    if (isValid) {
      onConfirm();
      setConfirmText("");
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Time Log</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to delete the time log for <strong>{workerName}</strong> starting at <strong>{clockIn}</strong>.
            </p>
            <p className="text-destructive font-medium">
              This action cannot be undone. This will permanently delete the time log record.
            </p>
            <div className="pt-2">
              <Label htmlFor="confirm" className="text-sm">
                Type <strong>delete</strong> to confirm:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete"
                className="mt-2"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Time Log
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
