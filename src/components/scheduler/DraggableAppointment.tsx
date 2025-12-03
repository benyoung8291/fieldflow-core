import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Clock, MapPin, MoreVertical, Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRef } from "react";

interface DraggableAppointmentProps {
  appointment: any;
  statusColor: string;
  onViewHistory: () => void;
  onDelete?: () => void;
  showFullDetails?: boolean;
}

export default function DraggableAppointment({
  appointment,
  statusColor,
  onViewHistory,
  onDelete,
  showFullDetails = false,
}: DraggableAppointmentProps) {
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const clickThreshold = 8;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `appointment-${appointment.id}`,
    data: {
      type: "appointment",
      appointment,
      appointmentId: appointment.id,
    },
  });

  const baseStyle = {
    transform: CSS.Translate.toString(transform),
  };

  // Map status color classes to actual border colors
  const getBorderColor = () => {
    if (statusColor.includes("muted")) return "hsl(var(--muted))";
    if (statusColor.includes("info")) return "hsl(var(--info))";
    if (statusColor.includes("warning")) return "hsl(var(--warning))";
    if (statusColor.includes("success")) return "hsl(var(--success))";
    if (statusColor.includes("destructive")) return "hsl(var(--destructive))";
    return "hsl(var(--border))";
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || 
        (e.target as HTMLElement).closest('[role="menuitem"]')) {
      return;
    }
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    
    // Call dnd-kit's handler to enable dragging
    listeners?.onPointerDown?.(e as any);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPos.current) return;
    
    const deltaX = Math.abs(e.clientX - pointerDownPos.current.x);
    const deltaY = Math.abs(e.clientY - pointerDownPos.current.y);
    
    // Only trigger click if pointer didn't move much (not a drag)
    if (deltaX <= clickThreshold && deltaY <= clickThreshold) {
      if ((e.target as HTMLElement).closest('button') || 
          (e.target as HTMLElement).closest('[role="menuitem"]')) {
        pointerDownPos.current = null;
        return;
      }
      
      // Check for Cmd (Mac) or Ctrl (Windows) key
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const url = `/scheduler?appointment=${appointment.id}`;
        window.open(url, '_blank');
        pointerDownPos.current = null;
        return;
      }
      
      onViewHistory();
    }
    
    pointerDownPos.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...baseStyle,
        borderLeftColor: getBorderColor(),
      }}
      className={cn(
        "p-2 rounded text-xs hover:shadow-md transition-shadow group relative bg-card border-l-4 select-none pointer-events-auto touch-none",
        isDragging && "opacity-50 cursor-grabbing",
        !isDragging && "cursor-grab"
      )}
      {...attributes}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLDivElement>}
    >
      {/* Duration badge - top right */}
      <div className="absolute top-0.5 right-0.5 bg-muted/70 backdrop-blur-sm text-[9px] font-medium px-1 py-0.5 rounded text-muted-foreground z-10 group-hover:opacity-0 transition-opacity">
        {(() => {
          const start = new Date(appointment.start_time);
          const end = new Date(appointment.end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          return (Math.round(hours * 10) / 10).toFixed(1);
        })()}h
      </div>

      <div className="pointer-events-none relative">
        <div className={cn(!showFullDetails && "font-medium truncate", showFullDetails && "space-y-2")}>
          {showFullDetails ? (
            <>
              <div className="flex items-center gap-1">
                <h4 className="font-semibold text-sm truncate">{appointment.title}</h4>
                {(appointment.is_recurring || appointment.parent_appointment_id) && (
                  <Repeat className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {format(new Date(appointment.start_time), "HH:mm")} - 
                  {format(new Date(appointment.end_time), "HH:mm")}
                </span>
              </div>
              {appointment.appointment_workers && appointment.appointment_workers.length > 0 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <Users className="h-3 w-3" />
                  <span className="truncate">
                    {appointment.appointment_workers.map((aw: any) => 
                      `${aw.profiles?.first_name || ''} ${aw.profiles?.last_name || ''}`
                    ).join(', ')}
                  </span>
                </div>
              )}
              {appointment.location_address && (
                <div className="flex items-center gap-1 text-[10px]">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{appointment.location_address.split(',')[0]}</span>
                </div>
              )}
              {appointment.service_orders && (
                <Badge variant="outline" className="text-xs">
                  {appointment.service_orders.order_number}
                </Badge>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="font-medium truncate">{appointment.title}</span>
                {(appointment.is_recurring || appointment.parent_appointment_id) && (
                  <Repeat className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(appointment.start_time), "HH:mm")}</span>
              </div>
              {appointment.appointment_workers && appointment.appointment_workers.length > 1 && (
                <div className="flex items-center gap-1 mt-1 text-[10px]">
                  <Users className="h-3 w-3" />
                  <span>{appointment.appointment_workers.length} workers</span>
                </div>
              )}
              {appointment.location_address && (
                <div className="flex items-center gap-1 mt-1 text-[10px]">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{appointment.location_address.split(',')[0]}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {onDelete && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto" style={{ zIndex: 20 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onDelete(); 
                }}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}