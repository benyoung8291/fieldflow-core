import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AppointmentHoverCard from "./AppointmentHoverCard";
import { useState, useRef } from "react";

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
  const [isDragIntent, setIsDragIntent] = useState(false);
  const pointerDownPos = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const dragThreshold = 8; // pixels to move before considering it a drag
  const dragDelay = 150; // milliseconds to hold before drag starts

  // Make card droppable for workers
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `appointment-drop-${appointment.id}`,
    data: {
      type: "appointment-card",
      appointmentId: appointment.id,
    },
  });

  // Make card draggable for moving between dates - but only when drag intent is detected
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `appointment-drag-${appointment.id}`,
    data: {
      type: "appointment",
      appointment: appointment,
      appointmentId: appointment.id,
    },
    disabled: !isDragIntent,
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  const workers = appointment.appointment_workers || [];
  const totalWorkerHours = workers.length * calculateAppointmentHours(appointment);
  const remainingHours = (estimatedHours || 0) - totalWorkerHours;

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't handle if clicking on interactive elements
    if ((e.target as HTMLElement).closest('[data-no-click]')) {
      return;
    }
    pointerDownPos.current = { x: e.clientX, y: e.clientY, timestamp: Date.now() };
    setIsDragIntent(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownPos.current) return;
    
    const deltaX = Math.abs(e.clientX - pointerDownPos.current.x);
    const deltaY = Math.abs(e.clientY - pointerDownPos.current.y);
    const timeSinceDown = Date.now() - pointerDownPos.current.timestamp;
    
    // If moved more than threshold OR held for delay time, it's a drag intent
    if ((deltaX > dragThreshold || deltaY > dragThreshold) || timeSinceDown > dragDelay) {
      setIsDragIntent(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPos.current) return;
    
    const deltaX = Math.abs(e.clientX - pointerDownPos.current.x);
    const deltaY = Math.abs(e.clientY - pointerDownPos.current.y);
    
    // If didn't move much, treat as a click
    if (deltaX <= dragThreshold && deltaY <= dragThreshold) {
      if (!(e.target as HTMLElement).closest('[data-no-click]')) {
        onClick();
      }
    }
    
    pointerDownPos.current = null;
    setIsDragIntent(false);
  };

  return (
    <AppointmentHoverCard appointment={appointment}>
      <Card
        ref={setNodeRef}
        {...attributes}
        {...(isDragIntent ? listeners : {})}
        className={cn(
          "p-2 hover:shadow-md transition-all group relative hover:border-primary/50",
          isOver && "ring-2 ring-primary ring-offset-2 bg-primary/5",
          isDragging && "opacity-50 cursor-grabbing",
          isDragIntent ? "cursor-grab" : "cursor-pointer"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          pointerDownPos.current = null;
          setIsDragIntent(false);
        }}
      >
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-dashed border-primary z-10 pointer-events-none">
          <span className="text-xs font-semibold text-primary bg-background px-2 py-1 rounded">
            Drop to assign worker
          </span>
        </div>
      )}

      <div className="space-y-2">
        {/* Duration badge - top right */}
        <div className="absolute top-0.5 right-0.5 bg-muted/70 backdrop-blur-sm text-[9px] font-medium px-1 py-0.5 rounded text-muted-foreground z-20">
          {calculateAppointmentHours(appointment)}h
        </div>

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
            <div className="flex flex-col gap-1">
              {workers.map((w: any) => (
                <Badge key={w.worker_id} variant="secondary" className="text-xs pr-1 flex items-center justify-between gap-1 w-full">
                  <span className="truncate">
                    {w.profiles?.first_name} {w.profiles?.last_name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-3 w-3 p-0 hover:bg-destructive/20 flex-shrink-0"
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
