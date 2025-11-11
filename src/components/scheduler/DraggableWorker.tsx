import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

  const getProficiencyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'expert':
        return 'bg-success/10 text-success border-success/20';
      case 'advanced':
        return 'bg-info/10 text-info border-info/20';
      case 'intermediate':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'beginner':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

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
      <div className="space-y-1.5">
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
        {worker.worker_skills && worker.worker_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {worker.worker_skills.slice(0, 3).map((ws: any, idx: number) => (
              <Badge 
                key={idx} 
                variant="outline" 
                className={cn("text-[10px] px-1.5 py-0", getProficiencyColor(ws.proficiency_level))}
              >
                {ws.skills?.name}
              </Badge>
            ))}
            {worker.worker_skills.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                +{worker.worker_skills.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
