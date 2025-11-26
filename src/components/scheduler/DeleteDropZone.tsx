import { useDroppable } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteDropZoneProps {
  isVisible: boolean;
}

export default function DeleteDropZone({ isVisible }: DeleteDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "delete-zone",
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
          ? "bg-destructive/20 border-destructive scale-110" 
          : "bg-muted/80 border-muted-foreground/20 scale-100"
      )}
    >
      <Trash2 
        className={cn(
          "h-6 w-6 transition-colors",
          isOver ? "text-destructive animate-pulse" : "text-muted-foreground"
        )} 
      />
      <div className="flex flex-col">
        <span className={cn(
          "font-semibold text-sm transition-colors",
          isOver ? "text-destructive" : "text-foreground"
        )}>
          Drop to Delete
        </span>
        <span className="text-xs text-muted-foreground">
          Drag appointment here to remove it
        </span>
      </div>
    </div>
  );
}
