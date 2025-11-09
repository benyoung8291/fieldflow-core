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
}

export default function DroppableTimeSlot({ 
  id, 
  date, 
  workerId, 
  hour,
  children, 
  className 
}: DroppableTimeSlotProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: {
      type: "time-slot",
      date,
      workerId,
      hour,
    },
  });

  const isDraggingServiceOrder = active?.data?.current?.type === "service-order";
  const isDraggingAppointment = active?.data?.current?.type === "appointment";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && isDraggingServiceOrder && "ring-2 ring-primary ring-offset-2",
        isOver && isDraggingAppointment && "ring-2 ring-warning ring-offset-2"
      )}
    >
      {children}
    </div>
  );
}
