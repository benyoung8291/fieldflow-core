import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentConfirmationBadgeProps {
  confirmations: Array<{
    status: string;
    worker?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  }>;
  compact?: boolean;
}

export function AppointmentConfirmationBadge({ confirmations, compact = false }: AppointmentConfirmationBadgeProps) {
  if (confirmations.length === 0) return null;

  const confirmedCount = confirmations.filter(c => c.status === "confirmed").length;
  const pendingCount = confirmations.filter(c => c.status === "pending").length;
  const declinedCount = confirmations.filter(c => c.status === "declined").length;

  const allConfirmed = confirmedCount === confirmations.length;
  const anyDeclined = declinedCount > 0;
  const anyPending = pendingCount > 0;

  if (compact) {
    if (allConfirmed) {
      return (
        <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3" />
          {confirmedCount}
        </Badge>
      );
    }
    if (anyDeclined) {
      return (
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3" />
          {declinedCount}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/20">
        <Clock className="h-3 w-3" />
        {pendingCount}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {confirmedCount > 0 && (
        <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3" />
          {confirmedCount} Confirmed
        </Badge>
      )}
      {pendingCount > 0 && (
        <Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3" />
          {pendingCount} Pending
        </Badge>
      )}
      {declinedCount > 0 && (
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3" />
          {declinedCount} Declined
        </Badge>
      )}
    </div>
  );
}
