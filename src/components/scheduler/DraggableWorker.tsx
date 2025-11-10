import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface DraggableWorkerProps {
  worker: any;
  isDragOverlay?: boolean;
}

export default function DraggableWorker({ worker, isDragOverlay }: DraggableWorkerProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `worker-${worker.id}`,
    data: {
      type: "worker",
      worker,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const initials = `${worker.first_name?.[0] || ''}${worker.last_name?.[0] || ''}`.toUpperCase();

  return (
    <Card
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      {...(!isDragOverlay ? listeners : {})}
      {...(!isDragOverlay ? attributes : {})}
      className={cn(
        "p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
        isDragging && !isDragOverlay && "opacity-20 cursor-grabbing",
        isDragOverlay && "shadow-2xl ring-2 ring-primary rotate-3 scale-105"
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {worker.first_name} {worker.last_name}
          </p>
        </div>
      </div>
    </Card>
  );
}
