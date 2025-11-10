import { useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DroppableAppointmentCardProps {
  appointment: any;
  lineItemsSummary?: string;
  estimatedHours?: number;
  onRemoveWorker: (workerId: string) => void;
  onClick: () => void;
}

export default function DroppableAppointmentCard({
  appointment,
  lineItemsSummary,
  estimatedHours,
  onRemoveWorker,
  onClick,
}: DroppableAppointmentCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `appointment-drop-${appointment.id}`,
    data: {
      type: "appointment-card",
      appointmentId: appointment.id,
    },
  });

  const workers = appointment.appointment_workers || [];
  const totalWorkerHours = workers.length * calculateAppointmentHours(appointment);
  const remainingHours = Math.max(0, (estimatedHours || 0) - totalWorkerHours);

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "p-2 cursor-pointer hover:shadow-md transition-all group",
        isOver && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onClick}
    >
      <div className="space-y-2">
        {/* Time */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {format(new Date(appointment.start_time), "HH:mm")} - {format(new Date(appointment.end_time), "HH:mm")}
          </span>
          <span className="font-semibold ml-1">
            ({calculateAppointmentHours(appointment)}h)
          </span>
        </div>

        {/* Line Items Summary */}
        {lineItemsSummary && (
          <div className="flex items-start gap-1 text-xs">
            <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2 italic text-muted-foreground">{lineItemsSummary}</span>
          </div>
        )}

        {/* Workers */}
        {workers.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-semibold">
              <Users className="h-3 w-3" />
              <span>Workers ({workers.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {workers.map((w: any) => (
                <Badge key={w.worker_id} variant="secondary" className="text-xs pr-1">
                  {w.profiles?.first_name} {w.profiles?.last_name}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-3 w-3 p-0 ml-1 hover:bg-destructive/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveWorker(w.worker_id);
                    }}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Remaining Hours */}
        {estimatedHours && (
          <div className="text-xs">
            <span className="text-muted-foreground">Remaining: </span>
            <span className={cn(
              "font-semibold",
              remainingHours > 0 ? "text-warning" : "text-success"
            )}>
              {remainingHours.toFixed(1)}h
            </span>
            {estimatedHours && (
              <span className="text-muted-foreground ml-1">
                / {estimatedHours.toFixed(1)}h estimated
              </span>
            )}
          </div>
        )}

        {/* Status */}
        <Badge 
          variant={appointment.status === "completed" ? "default" : "secondary"}
          className="text-xs w-fit"
        >
          {appointment.status}
        </Badge>

        {/* Drop zone indicator */}
        {workers.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-1 border-2 border-dashed border-muted rounded">
            Drop worker here to assign
          </div>
        )}
      </div>
    </Card>
  );
}

function calculateAppointmentHours(appointment: any): number {
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
}
