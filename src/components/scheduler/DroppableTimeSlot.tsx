import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DroppableTimeSlotProps {
  id: string;
  date: Date;
  workerId: string | null;
  hour?: number;
  children: ReactNode;
  className?: string;
  isAvailable?: boolean;
}

export default function DroppableTimeSlot({ 
  id, 
  date, 
  workerId, 
  hour,
  children, 
  className,
  isAvailable = true 
}: DroppableTimeSlotProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: {
      type: "time-slot",
      date,
      workerId,
      hour,
      isAvailable,
    },
    disabled: !isAvailable,
  });

  const isDraggingServiceOrder = active?.data?.current?.type === "service-order";
  const isDraggingAppointment = active?.data?.current?.type === "appointment";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative",
        className,
        !isAvailable && "opacity-30 cursor-not-allowed bg-muted/50",
        isOver && isAvailable && isDraggingServiceOrder && "ring-2 ring-primary ring-offset-2 bg-primary/5",
        isOver && isAvailable && isDraggingAppointment && "ring-2 ring-warning ring-offset-2 bg-warning/5"
      )}
    >
      {children}
    </div>
  );
}
