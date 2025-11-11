import { useDroppable } from "@dnd-kit/core";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DroppableQuoteColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  probabilityPercentage: number;
  children: React.ReactNode;
}

export default function DroppableQuoteColumn({
  id,
  title,
  color,
  count,
  totalAmount,
  weightedAmount,
  probabilityPercentage,
  children,
}: DroppableQuoteColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col h-full min-w-[300px]">
      <Card 
        className="flex-shrink-0 mb-4" 
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge variant="secondary">{count}</Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">${totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Weighted ({probabilityPercentage}%):</span>
              <span className="font-bold" style={{ color }}>
                ${weightedAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-3 p-3 rounded-lg bg-muted/20 min-h-[400px] overflow-y-auto transition-colors",
          isOver && "ring-2 ring-primary bg-primary/5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
