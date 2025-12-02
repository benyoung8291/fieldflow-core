import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistance, getDistanceWarningLevel } from "@/lib/distance";

interface DistanceWarningBadgeProps {
  distance: number | null;
  showIcon?: boolean;
}

export default function DistanceWarningBadge({ 
  distance, 
  showIcon = true 
}: DistanceWarningBadgeProps) {
  if (distance === null) {
    return (
      <Badge variant="outline" className="text-xs bg-muted">
        No location
      </Badge>
    );
  }

  const level = getDistanceWarningLevel(distance);
  const formatted = formatDistance(distance);

  const variants = {
    ok: {
      className: "bg-success/10 text-success border-success/20",
      Icon: CheckCircle,
    },
    warning: {
      className: "bg-warning/10 text-warning border-warning/20",
      Icon: AlertCircle,
    },
    danger: {
      className: "bg-destructive/10 text-destructive border-destructive/20",
      Icon: AlertTriangle,
    },
  };

  const { className, Icon } = variants[level];

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {formatted}
    </Badge>
  );
}
