import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import AppointmentHoverCard from "./AppointmentHoverCard";

interface DroppableAppointmentCardProps {
  appointment: any;
  lineItemsSummary?: string;
  estimatedHours?: number;
  onRemoveWorker: (workerId: string) => void;
  onClick: () => void;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  selectedCount?: number;
}

export default function DroppableAppointmentCard({
  appointment,
  lineItemsSummary,
  estimatedHours,
  onRemoveWorker,
  onClick,
  isSelected = false,
  onSelectionChange,
  selectedCount = 0,
}: DroppableAppointmentCardProps) {
  // Make card droppable for workers
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `appointment-drop-${appointment.id}`,
    data: {
      type: "appointment-card",
      appointmentId: appointment.id,
    },
  });

  // Make card draggable for moving between dates
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `appointment-drag-${appointment.id}`,
    data: {
      type: "appointment",
      appointment: appointment,
      isSelected,
      selectedCount,
    },
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  const workers = appointment.appointment_workers || [];
  const totalWorkerHours = workers.length * calculateAppointmentHours(appointment);
  const remainingHours = (estimatedHours || 0) - totalWorkerHours;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking checkbox or worker remove button
    if ((e.target as HTMLElement).closest('[data-no-click]')) {
      return;
    }
    onClick();
  };

  return (
    <AppointmentHoverCard appointment={appointment}>
      <Card
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          "p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative",
          isOver && "ring-2 ring-primary ring-offset-2 bg-primary/5",
          isDragging && "opacity-50",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={handleCardClick}
      >
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-dashed border-primary z-10 pointer-events-none">
          <span className="text-xs font-semibold text-primary bg-background px-2 py-1 rounded">
            Drop to assign worker
          </span>
        </div>
      )}
      
      {/* Bulk selection indicator */}
      {isSelected && selectedCount > 1 && (
        <div className="absolute top-1 right-1 bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-semibold z-10">
          {selectedCount} selected
        </div>
      )}

      <div className="space-y-2">
        {/* Selection checkbox */}
        {onSelectionChange && (
          <div className="flex items-center gap-2" data-no-click>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectionChange}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-xs text-muted-foreground">Select for bulk move</span>
          </div>
        )}
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
                    data-no-click
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
          <div className={cn(
            "text-xs p-1.5 rounded-md border",
            remainingHours < 0 
              ? "bg-destructive/10 border-destructive/30" 
              : remainingHours > 0 
                ? "bg-warning/10 border-warning/30"
                : "bg-success/10 border-success/30"
          )}>
            <span className="text-muted-foreground">Remaining: </span>
            <span className={cn(
              "font-bold",
              remainingHours < 0 ? "text-destructive" : remainingHours > 0 ? "text-warning" : "text-success"
            )}>
              {remainingHours.toFixed(1)}h
            </span>
            <span className="text-muted-foreground ml-1">
              / {estimatedHours.toFixed(1)}h estimated
            </span>
            {remainingHours < 0 && (
              <span className="block text-[10px] text-destructive font-semibold mt-0.5">
                ⚠ OVER CAPACITY
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
    </AppointmentHoverCard>
  );
}

function calculateAppointmentHours(appointment: any): number {
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
}
