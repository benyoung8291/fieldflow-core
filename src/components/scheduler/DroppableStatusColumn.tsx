import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DroppableStatusColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  children: React.ReactNode;
}

export default function DroppableStatusColumn({
  id,
  title,
  color,
  count,
  children,
}: DroppableStatusColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "transition-colors",
        isOver && "ring-2 ring-primary"
      )}
    >
      <CardHeader className={cn("p-2", color)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold">{title}</CardTitle>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-1 min-h-[300px]">
        {children}
      </CardContent>
    </Card>
  );
}
