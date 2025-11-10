import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface CreateAppointmentButtonProps {
  serviceOrderId: string;
  serviceOrderTitle: string;
  date: Date;
  onCreateAppointment: (serviceOrderId: string, date: Date, startTime: string, endTime: string) => void;
}

export default function CreateAppointmentButton({
  serviceOrderId,
  serviceOrderTitle,
  date,
  onCreateAppointment,
}: CreateAppointmentButtonProps) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const handleCreate = () => {
    onCreateAppointment(serviceOrderId, date, startTime, endTime);
    setOpen(false);
    setStartTime("09:00");
    setEndTime("17:00");
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Service Order</Label>
              <p className="text-sm text-muted-foreground mt-1">{serviceOrderTitle}</p>
            </div>
            <div>
              <Label>Date</Label>
              <p className="text-sm text-muted-foreground mt-1">{format(date, "PPP")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
