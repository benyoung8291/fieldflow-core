import { Badge } from "@/components/ui/badge";
import { MapPin, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface TimeLogLocationCellProps {
  workerLat?: number | null;
  workerLng?: number | null;
  appointmentLat?: number | null;
  appointmentLng?: number | null;
  distance?: number | null;
  type: "clock_in" | "clock_out";
  timestamp?: string;
}

export default function TimeLogLocationCell({
  workerLat,
  workerLng,
  appointmentLat,
  appointmentLng,
  distance,
  type,
  timestamp,
}: TimeLogLocationCellProps) {
  const hasWorkerLocation = workerLat != null && workerLng != null;
  const hasAppointmentLocation = appointmentLat != null && appointmentLng != null;

  // Determine GPS quality status
  const getStatus = () => {
    if (!hasWorkerLocation) {
      return {
        label: "No GPS",
        icon: AlertCircle,
        variant: "destructive" as const,
        color: "text-destructive",
      };
    }

    if (!hasAppointmentLocation) {
      return {
        label: "GPS Only",
        icon: MapPin,
        variant: "outline" as const,
        color: "text-muted-foreground",
      };
    }

    if (distance === null) {
      return {
        label: "N/A",
        icon: AlertCircle,
        variant: "outline" as const,
        color: "text-muted-foreground",
      };
    }

    if (distance <= 500) {
      return {
        label: "At Site",
        icon: CheckCircle,
        variant: "outline" as const,
        color: "text-success",
      };
    }

    if (distance <= 2000) {
      return {
        label: "Warning",
        icon: AlertCircle,
        variant: "outline" as const,
        color: "text-warning",
      };
    }

    return {
      label: "Far",
      icon: AlertTriangle,
      variant: "outline" as const,
      color: "text-destructive",
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  if (!hasWorkerLocation) {
    return (
      <Badge variant={status.variant} className={cn("text-xs", status.color)}>
        <Icon className="h-3 w-3 mr-1" />
        {status.label}
      </Badge>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-left">
          <div className="flex items-center gap-1">
            <Badge variant={status.variant} className={cn("text-xs", status.color)}>
              <Icon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {workerLat.toFixed(4)}, {workerLng.toFixed(4)}
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {type === "clock_in" ? "Clock In" : "Clock Out"} Location
            </h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latitude:</span>
                <span className="font-mono">{workerLat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Longitude:</span>
                <span className="font-mono">{workerLng.toFixed(6)}</span>
              </div>
              {timestamp && (
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground">Time:</span>
                  <span>{new Date(timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          
          {distance !== null && hasAppointmentLocation && (
            <div className="border-t pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Distance from site:</span>
                <span className={cn("font-semibold", status.color)}>
                  {distance >= 1000
                    ? `${(distance / 1000).toFixed(2)} km`
                    : `${Math.round(distance)} m`}
                </span>
              </div>
            </div>
          )}
          
          {!hasAppointmentLocation && (
            <div className="text-xs text-muted-foreground italic border-t pt-2">
              Appointment location not set - cannot calculate distance
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
