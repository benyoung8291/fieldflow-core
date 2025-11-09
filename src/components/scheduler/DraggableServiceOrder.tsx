import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Calendar, CalendarRange, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DraggableServiceOrderProps {
  serviceOrder: any;
  remainingHours: number;
  lineItemsSummary?: string;
}

export default function DraggableServiceOrder({ serviceOrder, remainingHours, lineItemsSummary }: DraggableServiceOrderProps) {
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
            <div className="truncate font-medium text-foreground">
              {serviceOrder.customers.name}
            </div>
          )}
          
          {serviceOrder.estimated_hours && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Est: {serviceOrder.estimated_hours}h | Need {remainingHours.toFixed(1)}h more</span>
            </div>
          )}

          {serviceOrder.preferred_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(serviceOrder.preferred_date), "MMM d, yyyy")}</span>
            </div>
          )}

          {serviceOrder.preferred_date_start && serviceOrder.preferred_date_end && (
            <div className="flex items-center gap-1">
              <CalendarRange className="h-3 w-3" />
              <span>
                {format(new Date(serviceOrder.preferred_date_start), "MMM d")} - {format(new Date(serviceOrder.preferred_date_end), "MMM d")}
              </span>
            </div>
          )}

          {lineItemsSummary && (
            <div className="flex items-start gap-1 pt-1">
              <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2 text-xs italic">{lineItemsSummary}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
