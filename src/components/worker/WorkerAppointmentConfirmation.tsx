import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { useAppointmentConfirmations } from "@/hooks/useAppointmentConfirmations";
import { format } from "date-fns";
import { useState } from "react";

interface WorkerAppointmentConfirmationProps {
  appointmentId: string;
  workerId: string;
  appointmentTitle: string;
  startTime: string;
  endTime: string;
}

export function WorkerAppointmentConfirmation({
  appointmentId,
  workerId,
  appointmentTitle,
  startTime,
  endTime,
}: WorkerAppointmentConfirmationProps) {
  const { confirmations, confirmAppointment } = useAppointmentConfirmations(appointmentId);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  
  const myConfirmation = confirmations.find(c => c.worker_id === workerId);

  if (!myConfirmation || myConfirmation.status !== "pending") {
    return null;
  }

  const handleConfirm = () => {
    confirmAppointment({ confirmationId: myConfirmation.id, status: "confirmed" });
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      setShowDeclineInput(true);
      return;
    }
    confirmAppointment({ 
      confirmationId: myConfirmation.id, 
      status: "declined",
      declineReason: declineReason.trim()
    });
  };

  return (
    <Card className="border-warning bg-warning/5">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Clock className="h-5 w-5 text-warning mt-0.5" />
          <div className="flex-1">
            <CardTitle className="text-base">Confirmation Required</CardTitle>
            <CardDescription>
              Please confirm your assignment for this appointment
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="font-medium">{appointmentTitle}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(startTime), "EEEE, MMMM d, yyyy")}
          </p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(startTime), "h:mm a")} - {format(new Date(endTime), "h:mm a")}
          </p>
        </div>
        {showDeclineInput ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Reason for declining (required)</label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Please provide a reason for declining this appointment..."
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleDecline}
                variant="destructive"
                className="flex-1 gap-2"
                disabled={!declineReason.trim()}
              >
                <XCircle className="h-4 w-4" />
                Confirm Decline
              </Button>
              <Button 
                onClick={() => {
                  setShowDeclineInput(false);
                  setDeclineReason("");
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button 
              onClick={handleConfirm}
              className="flex-1 gap-2"
              variant="default"
            >
              <CheckCircle className="h-4 w-4" />
              Confirm Assignment
            </Button>
            <Button 
              onClick={() => setShowDeclineInput(true)}
              variant="outline"
              className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <XCircle className="h-4 w-4" />
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
