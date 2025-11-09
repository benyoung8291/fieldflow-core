import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableServiceOrderProps {
  serviceOrder: any;
  remainingHours: number;
}

export default function DraggableServiceOrder({ serviceOrder, remainingHours }: DraggableServiceOrderProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `service-order-${serviceOrder.id}`,
    data: {
      type: "service-order",
      serviceOrder,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow",
        isDragging && "opacity-50"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {serviceOrder.order_number}
              </Badge>
              <Badge variant={serviceOrder.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                {serviceOrder.priority}
              </Badge>
            </div>
            <h4 className="font-semibold text-sm mt-1 truncate">{serviceOrder.title}</h4>
          </div>
        </div>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          {serviceOrder.customers && (
            <div className="truncate">
              {serviceOrder.customers.name}
            </div>
          )}
          
          {serviceOrder.estimated_hours && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Need {remainingHours.toFixed(1)}h more</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
