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
      <CardHeader className={cn("p-4", color)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Badge variant="secondary" className="ml-2">
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 min-h-[400px]">
        {children}
      </CardContent>
    </Card>
  );
}
