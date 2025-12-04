import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Briefcase } from "lucide-react";
import { SubcontractorWorker } from "@/hooks/useSubcontractorWorkers";

interface DraggableSubcontractorProps {
  subcontractor: SubcontractorWorker;
  isDragOverlay?: boolean;
}

export default function DraggableSubcontractor({ subcontractor, isDragOverlay }: DraggableSubcontractorProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `subcontractor-${subcontractor.id}`,
    data: {
      type: "subcontractor",
      subcontractor,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const initials = `${subcontractor.first_name?.[0] || ''}${subcontractor.last_name?.[0] || ''}`.toUpperCase();

  const getStateColor = (state: string | null) => {
    if (!state) return 'bg-muted text-muted-foreground';
    
    const stateColors: Record<string, string> = {
      'VIC': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'NSW': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
      'QLD': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'SA': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'WA': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'TAS': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'NT': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'ACT': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return stateColors[state] || 'bg-muted text-muted-foreground';
  };

  return (
    <Card
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      {...(!isDragOverlay ? listeners : {})}
      {...(!isDragOverlay ? attributes : {})}
      className={cn(
        "p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
        "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
        isDragging && !isDragOverlay && "opacity-20 cursor-grabbing",
        isDragOverlay && "shadow-2xl ring-2 ring-violet-500 rotate-3 scale-105"
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 bg-violet-200 dark:bg-violet-800">
            <AvatarFallback className="text-xs bg-violet-200 text-violet-700 dark:bg-violet-800 dark:text-violet-200">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {subcontractor.first_name} {subcontractor.last_name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
              <Briefcase className="h-2.5 w-2.5" />
              {subcontractor.supplier_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {subcontractor.worker_state && (
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5 py-0", getStateColor(subcontractor.worker_state))}
            >
              {subcontractor.worker_state}
            </Badge>
          )}
          <Badge 
            variant="outline" 
            className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700"
          >
            Subcontractor
          </Badge>
        </div>
      </div>
    </Card>
  );
}
