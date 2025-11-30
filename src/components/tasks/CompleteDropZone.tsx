import { useDroppable } from "@dnd-kit/core";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompleteDropZoneProps {
  isVisible: boolean;
}

export default function CompleteDropZone({ isVisible }: CompleteDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "complete-zone",
  });

  if (!isVisible) return null;

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-200",
        "px-8 py-6 rounded-lg border-2 border-dashed",
        "flex items-center gap-3 shadow-lg backdrop-blur-sm",
        isOver 
          ? "bg-green-500/20 border-green-500 scale-110" 
          : "bg-muted/80 border-muted-foreground/20 scale-100"
      )}
    >
      <CheckCircle 
        className={cn(
          "h-6 w-6 transition-colors",
          isOver ? "text-green-500 animate-pulse" : "text-muted-foreground"
        )} 
      />
      <div className="flex flex-col">
        <span className={cn(
          "font-semibold text-sm transition-colors",
          isOver ? "text-green-600" : "text-foreground"
        )}>
          Drop to Complete
        </span>
        <span className="text-xs text-muted-foreground">
          Drag task here to mark as completed
        </span>
      </div>
    </div>
  );
}
