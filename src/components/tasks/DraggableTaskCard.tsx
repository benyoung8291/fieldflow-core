import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, isPast, startOfDay } from "date-fns";
import { Calendar, Link as LinkIcon, ExternalLink, CheckSquare } from "lucide-react";

interface DraggableTaskCardProps {
  task: any;
  onTaskClick: (task: any) => void;
  onNavigateToLinked: (module: string, id: string) => void;
  subtaskCount?: number;
  completedSubtaskCount?: number;
}

export default function DraggableTaskCard({ 
  task, 
  onTaskClick, 
  onNavigateToLinked,
  subtaskCount = 0,
  completedSubtaskCount = 0
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Check if task is overdue
  const isOverdue = task.due_date && isPast(startOfDay(new Date(task.due_date))) && task.status !== 'completed';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
          isDragging && "opacity-50",
          isOverdue && "border-destructive border-2"
        )}
        onClick={() => onTaskClick(task)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-medium text-sm line-clamp-2 flex-1">{task.title}</h4>
            <Badge className={cn("text-xs shrink-0", getPriorityColor(task.priority))}>
              {task.priority}
            </Badge>
          </div>
          
          {task.show_description_on_card && task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs mb-2">
            {task.tags && task.tags.length > 0 && task.tags.map((tag: string, index: number) => (
              <Badge 
                key={index} 
                variant="secondary"
                className="text-xs"
              >
                {tag}
              </Badge>
            ))}
            
            {subtaskCount > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <CheckSquare className="h-3 w-3" />
                {completedSubtaskCount}/{subtaskCount}
              </Badge>
            )}
          </div>

          {task.linked_module && task.linked_record_name && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 w-full justify-start"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToLinked(task.linked_module, task.linked_record_id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <LinkIcon className="h-3 w-3" />
              <span className="truncate">{task.document_type}: {task.linked_record_name}</span>
              <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
