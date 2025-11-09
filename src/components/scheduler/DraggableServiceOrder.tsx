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
        "p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
        isDragging && "opacity-50",
        // Priority color indicators
        serviceOrder.priority === "urgent" && "border-l-2 border-l-destructive",
        serviceOrder.priority === "high" && "border-l-2 border-l-orange-500",
        serviceOrder.priority === "normal" && "border-l-2 border-l-primary"
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {serviceOrder.order_number}
              </Badge>
              <Badge variant={serviceOrder.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                {serviceOrder.priority}
              </Badge>
            </div>
            <h4 className="font-semibold text-xs mt-1 truncate">{serviceOrder.title}</h4>
          </div>
        </div>
        
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          {serviceOrder.customers && (
            <div className="truncate font-medium text-foreground">
              {serviceOrder.customers.name}
            </div>
          )}
          
          {serviceOrder.estimated_hours && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Need {remainingHours.toFixed(1)}h</span>
            </div>
          )}

          {serviceOrder.preferred_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(serviceOrder.preferred_date), "MMM d")}</span>
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
            <div className="flex items-start gap-1 pt-0.5">
              <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2 italic">{lineItemsSummary}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
