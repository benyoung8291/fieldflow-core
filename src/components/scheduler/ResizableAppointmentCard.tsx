import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AppointmentHoverCard from "./AppointmentHoverCard";

interface ResizableAppointmentCardProps {
  appointment: any;
  lineItemsSummary?: string;
  estimatedHours?: number;
  onRemoveWorker: (workerId: string | null, contactId: string | null) => void;
  onClick: () => void;
  onResize: (appointmentId: string, newStartTime: Date, newEndTime: Date) => void;
  pixelsPerHour: number;
}

export default function ResizableAppointmentCard({
  appointment,
  lineItemsSummary,
  estimatedHours,
  onRemoveWorker,
  onClick,
  onResize,
  pixelsPerHour,
}: ResizableAppointmentCardProps) {
  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [tempHeight, setTempHeight] = useState<number | null>(null);
  const [tempTop, setTempTop] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);
  const startTop = useRef<number>(0);

  const startTime = new Date(appointment.start_time);
  const endTime = new Date(appointment.end_time);
  const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  const height = durationHours * pixelsPerHour;

  const workers = appointment.appointment_workers || [];

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current) return;

      const deltaY = e.clientY - startY.current;

      if (isResizing === 'bottom') {
        const newHeight = Math.max(pixelsPerHour / 2, startHeight.current + deltaY); // Min 30 minutes
        setTempHeight(newHeight);
      } else if (isResizing === 'top') {
        const newHeight = Math.max(pixelsPerHour / 2, startHeight.current - deltaY);
        const newTop = startTop.current + deltaY;
        setTempHeight(newHeight);
        setTempTop(newTop);
      }
    };

    const handleMouseUp = () => {
      if (!cardRef.current) return;

      let newStartTime = new Date(startTime);
      let newEndTime = new Date(endTime);

      // Snap to 30-minute intervals
      const snapToInterval = (date: Date) => {
        const minutes = date.getMinutes();
        const roundedMinutes = Math.round(minutes / 30) * 30;
        const snapped = new Date(date);
        snapped.setMinutes(roundedMinutes, 0, 0);
        return snapped;
      };

      if (isResizing === 'bottom' && tempHeight !== null) {
        const newDurationHours = tempHeight / pixelsPerHour;
        newEndTime = new Date(startTime.getTime() + newDurationHours * 60 * 60 * 1000);
        newEndTime = snapToInterval(newEndTime);
      } else if (isResizing === 'top' && tempHeight !== null && tempTop !== null) {
        const timeDeltaMs = (tempTop - startTop.current) / pixelsPerHour * 60 * 60 * 1000;
        newStartTime = new Date(startTime.getTime() + timeDeltaMs);
        newStartTime = snapToInterval(newStartTime);
      }

      onResize(appointment.id, newStartTime, newEndTime);
      setIsResizing(null);
      setTempHeight(null);
      setTempTop(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, appointment.id, startTime, endTime, pixelsPerHour, tempHeight, tempTop, onResize]);

  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(edge);
    startY.current = e.clientY;
    startHeight.current = cardRef.current?.offsetHeight || height;
    startTop.current = cardRef.current?.offsetTop || 0;
  };

  const displayHeight = tempHeight !== null ? tempHeight : height;
  const displayTop = tempTop !== null ? tempTop - startTop.current : 0;

  return (
    <AppointmentHoverCard appointment={appointment}>
      <div
        ref={cardRef}
        className="relative"
        style={{
          height: `${displayHeight}px`,
          transform: `translateY(${displayTop}px)`,
          transition: isResizing ? 'none' : 'transform 0.2s',
        }}
      >
        {/* Top resize handle */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-10 hover:bg-primary/50 transition-colors",
            isResizing === 'top' && "bg-primary"
          )}
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        />

        <Card
          className={cn(
            "h-full p-2 hover:shadow-md transition-shadow cursor-pointer overflow-hidden",
            isResizing && "ring-2 ring-primary"
          )}
          onClick={onClick}
        >
          <div className="space-y-1 h-full flex flex-col">
            {/* Duration badge - top right */}
            <div className="absolute top-0.5 right-0.5 bg-muted/70 backdrop-blur-sm text-[9px] font-medium px-1 py-0.5 rounded text-muted-foreground z-10">
              {durationHours.toFixed(1)}h
            </div>

            {/* Time */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Clock className="h-3 w-3" />
              <span>
                {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
              </span>
            </div>

            {/* Line Items Summary */}
            {lineItemsSummary && displayHeight > 60 && (
              <div className="text-xs italic text-muted-foreground line-clamp-1">
                {lineItemsSummary}
              </div>
            )}

            {/* Workers */}
            {workers.length > 0 && displayHeight > 80 && (
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-1 text-xs font-semibold mb-1">
                  <Users className="h-3 w-3" />
                  <span>Workers ({workers.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {workers.map((w: any) => {
                    const isSubcontractor = !w.worker_id && w.contact_id;
                    const uniqueKey = w.worker_id || w.contact_id;
                    const initials = isSubcontractor
                      ? `${w.contacts?.first_name?.[0] || ''}${w.contacts?.last_name?.[0] || ''}`
                      : `${w.profiles?.first_name?.[0] || ''}${w.profiles?.last_name?.[0] || ''}`;

                    return (
                      <Badge 
                        key={uniqueKey} 
                        variant={isSubcontractor ? "outline" : "secondary"}
                        className={cn(
                          "text-xs pr-1",
                          isSubcontractor && "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-950 dark:border-violet-700 dark:text-violet-200"
                        )}
                      >
                        {initials}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-3 w-3 p-0 ml-1 hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveWorker(w.worker_id, w.contact_id);
                          }}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status */}
            <Badge 
              variant={appointment.status === "completed" ? "default" : "secondary"}
              className="text-xs w-fit mt-auto"
            >
              {appointment.status}
            </Badge>
          </div>
        </Card>

        {/* Bottom resize handle */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize z-10 hover:bg-primary/50 transition-colors",
            isResizing === 'bottom' && "bg-primary"
          )}
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
      </div>
    </AppointmentHoverCard>
  );
}
