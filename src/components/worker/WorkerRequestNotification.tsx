import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WorkerRequestNotificationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: any[];
  appointmentId: string;
}

export function WorkerRequestNotification({
  open,
  onOpenChange,
  requests,
  appointmentId,
}: WorkerRequestNotificationProps) {
  const navigate = useNavigate();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "closed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getPendingCount = (markups: any[]) => {
    return markups?.filter((m) => m.status === "pending").length || 0;
  };

  const handleViewRequest = (ticketId: string) => {
    onOpenChange(false);
    navigate(`/worker/appointments/${appointmentId}/request/${ticketId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle className="text-xl">Customer Requests</SheetTitle>
          <SheetDescription>
            {requests.length} request{requests.length !== 1 ? "s" : ""} need your attention at this location
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {requests.map((request) => {
            const pendingCount = getPendingCount(request.ticket_markups);
            return (
              <div
                key={request.id}
                className="p-4 rounded-lg border bg-card space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(request.status)}
                      <span className="font-medium text-sm">
                        #{request.ticket_number}
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      {request.subject}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {pendingCount} pending
                  </Badge>
                </div>

                <Button
                  onClick={() => handleViewRequest(request.id)}
                  className="w-full"
                  size="sm"
                >
                  View Details
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="w-full"
          >
            I'll Check These Later
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
