import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface RecurringEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (editType: "single" | "series") => void;
  action: "edit" | "delete";
}

export default function RecurringEditDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  action 
}: RecurringEditDialogProps) {
  const [editType, setEditType] = useState<"single" | "series">("single");

  const handleConfirm = () => {
    onConfirm(editType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "edit" ? "Edit Recurring Appointment" : "Delete Recurring Appointment"}
          </DialogTitle>
          <DialogDescription>
            This is a recurring appointment. What would you like to {action}?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={editType} onValueChange={(value) => setEditType(value as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="single" />
            <Label htmlFor="single" className="font-normal cursor-pointer">
              This appointment only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="series" id="series" />
            <Label htmlFor="series" className="font-normal cursor-pointer">
              This and all future appointments in the series
            </Label>
          </div>
        </RadioGroup>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
