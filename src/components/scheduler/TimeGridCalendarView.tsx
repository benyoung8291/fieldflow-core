import { format, startOfWeek, endOfWeek, eachDayOfInterval, setHours, setMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ResizableAppointmentCard from "./ResizableAppointmentCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TimeGridCalendarViewProps {
  currentDate: Date;
  appointments: any[];
  onAppointmentClick: (id: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string) => void;
  onResizeAppointment: (appointmentId: string, newStartTime: Date, newEndTime: Date) => void;
  onCreateAppointment: (serviceOrderId: string, date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const PIXELS_PER_HOUR = 80;

export default function TimeGridCalendarView({
  currentDate,
  appointments,
  onAppointmentClick,
  onRemoveWorker,
  onResizeAppointment,
  onCreateAppointment,
}: TimeGridCalendarViewProps) {
  // Fetch service orders with appointments and line items
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders-for-time-grid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name),
          service_order_line_items(*)
        `)
        .in("status", ["draft", "scheduled", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Get date range based on view type
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Group appointments by service order and calculate summaries
  const appointmentsByServiceOrder = serviceOrders.map(order => {
    const lineItems = order.service_order_line_items || [];
    const lineItemsSummary = lineItems.length > 0
      ? lineItems
          .slice(0, 3)
          .map((item: any) => `${item.quantity}x ${item.description}`)
          .join(", ") + (lineItems.length > 3 ? "..." : "")
      : "";

    return {
      ...order,
      appointments: appointments.filter(apt => apt.service_order_id === order.id),
      lineItemsSummary,
    };
  });

  const getAppointmentsForDayAndServiceOrder = (serviceOrderId: string, day: Date) => {
    return appointments.filter(apt => 
      apt.service_order_id === serviceOrderId &&
      format(new Date(apt.start_time), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
    );
  };

  const getTopPosition = (time: Date) => {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    return (hours + minutes / 60) * PIXELS_PER_HOUR;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Row - Days */}
      <div className="grid grid-cols-8 gap-2 mb-2 flex-shrink-0 sticky top-0 bg-background z-20 pb-2">
        <div className="font-semibold text-sm p-2 w-48">Service Order</div>
        {days.map(day => (
          <div key={day.toISOString()} className="text-center font-semibold text-sm p-2">
            <div>{format(day, "EEE")}</div>
            <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
          </div>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto relative">
        <div className="relative" style={{ minHeight: `${HOURS.length * PIXELS_PER_HOUR}px` }}>
          {/* Time labels column */}
          <div className="absolute left-0 top-0 w-16 z-10">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="text-xs text-muted-foreground text-right pr-2"
                style={{ height: `${PIXELS_PER_HOUR}px`, lineHeight: `${PIXELS_PER_HOUR}px` }}
              >
                {format(setHours(new Date(), hour), "HH:mm")}
              </div>
            ))}
          </div>

          {/* Service Order Rows */}
          <div className="pl-16">
            {appointmentsByServiceOrder.map((order, orderIndex) => (
              <div key={order.id} className="grid grid-cols-8 gap-2 mb-4">
                {/* Service Order Info */}
                <div className="sticky left-16 z-10 bg-background">
                  <Card className="p-2 h-fit">
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs w-fit">
                        {order.order_number}
                      </Badge>
                      <div className="font-semibold text-sm truncate">{order.title}</div>
                      {order.customers && (
                        <div className="text-xs text-muted-foreground truncate">
                          {order.customers.name}
                        </div>
                      )}
                      {order.estimated_hours && (
                        <div className="text-xs text-muted-foreground">
                          Est: {order.estimated_hours}h
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Time grid for each day */}
                {days.map((day, dayIndex) => {
                  const dayAppointments = getAppointmentsForDayAndServiceOrder(order.id, day);
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className="relative border-l border-border"
                      style={{ minHeight: `${HOURS.length * PIXELS_PER_HOUR}px` }}
                    >
                      {/* Hour grid lines */}
                      {HOURS.map(hour => (
                        <div
                          key={hour}
                          className="border-b border-border/30 group relative"
                          style={{ height: `${PIXELS_PER_HOUR}px` }}
                        >
                          {/* Add appointment button on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity h-full flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => onCreateAppointment(order.id, day, hour)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Appointments positioned absolutely */}
                      {dayAppointments.map(apt => {
                        const top = getTopPosition(new Date(apt.start_time));
                        
                        return (
                          <div
                            key={apt.id}
                            className="absolute left-1 right-1 z-10"
                            style={{ top: `${top}px` }}
                          >
                            <ResizableAppointmentCard
                              appointment={apt}
                              lineItemsSummary={order.lineItemsSummary}
                              estimatedHours={order.estimated_hours}
                              onRemoveWorker={(workerId) => onRemoveWorker(apt.id, workerId)}
                              onClick={() => onAppointmentClick(apt.id)}
                              onResize={onResizeAppointment}
                              pixelsPerHour={PIXELS_PER_HOUR}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}

            {appointmentsByServiceOrder.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No service orders found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
