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

  const allConfirmed = confirmedCount === confirmations.length && confirmations.length > 0;
  const anyDeclined = declinedCount > 0;
  const anyPending = pendingCount > 0;

  if (compact) {
    // Show declined first as it's most critical
    if (anyDeclined) {
      return (
        <Badge variant="outline" className="gap-1 bg-destructive text-destructive-foreground border-destructive font-semibold">
          <XCircle className="h-3 w-3" />
          {declinedCount} Declined
        </Badge>
      );
    }
    if (allConfirmed) {
      return (
        <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3" />
          {confirmedCount}
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
      {declinedCount > 0 && (
        <Badge variant="outline" className="gap-1 bg-destructive text-destructive-foreground border-destructive font-semibold animate-pulse">
          <XCircle className="h-3.5 w-3.5" />
          {declinedCount} Declined - Action Required
        </Badge>
      )}
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
    </div>
  );
}
