import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DroppableAppointmentCard from "./DroppableAppointmentCard";
import CreateAppointmentButton from "./CreateAppointmentButton";

interface ServiceOrdersCalendarViewProps {
  currentDate: Date;
  appointments: any[];
  viewType: "day" | "week" | "timegrid" | "month" | "kanban";
  onAppointmentClick: (id: string) => void;
  onCreateAppointment: (serviceOrderId: string, date: Date, startTime: string, endTime: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string) => void;
  selectedAppointmentIds: Set<string>;
  onSelectionChange: (appointmentId: string, selected: boolean) => void;
}

export default function ServiceOrdersCalendarView({
  currentDate,
  appointments,
  viewType,
  onAppointmentClick,
  onCreateAppointment,
  onRemoveWorker,
  selectedAppointmentIds,
  onSelectionChange,
}: ServiceOrdersCalendarViewProps) {
  // Fetch service orders with appointments and line items
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders-for-calendar"],
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

  const getAppointmentsForDay = (serviceOrderId: string, day: Date) => {
    return appointments.filter(apt => 
      apt.service_order_id === serviceOrderId &&
      format(new Date(apt.start_time), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
    );
  };

  const calculateTotalHours = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  return (
    <div className="h-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header Row - Days */}
        <div className="grid grid-cols-8 gap-2 mb-2">
          <div className="font-semibold text-sm p-2">Service Order</div>
          {days.map(day => (
            <div key={day.toISOString()} className="text-center font-semibold text-sm p-2">
              <div>{format(day, "EEE")}</div>
              <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
            </div>
          ))}
        </div>

        {/* Service Order Rows */}
        <div className="space-y-2">
          {appointmentsByServiceOrder.map(order => (
            <div key={order.id} className="grid grid-cols-8 gap-2">
              {/* Service Order Info */}
              <Card className="p-2 flex flex-col justify-center">
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

              {/* Appointments for each day */}
              {days.map(day => {
                const dayAppointments = getAppointmentsForDay(order.id, day);
                
                return (
                  <DroppableTimeSlot
                    key={day.toISOString()}
                    id={`so-slot-${order.id}-${day.toISOString()}`}
                    date={day}
                    workerId={null}
                    className="min-h-[120px] p-2"
                  >
                    <div className="space-y-2 h-full">
                      {dayAppointments.length > 0 ? (
                        dayAppointments.map(apt => (
                          <DroppableAppointmentCard
                            key={apt.id}
                            appointment={apt}
                            lineItemsSummary={order.lineItemsSummary}
                            estimatedHours={order.estimated_hours}
                            onRemoveWorker={(workerId) => onRemoveWorker(apt.id, workerId)}
                            onClick={() => onAppointmentClick(apt.id)}
                            isSelected={selectedAppointmentIds.has(apt.id)}
                            onSelectionChange={(selected) => onSelectionChange(apt.id, selected)}
                            selectedCount={selectedAppointmentIds.size}
                          />
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <CreateAppointmentButton
                            serviceOrderId={order.id}
                            serviceOrderTitle={order.title}
                            date={day}
                            onCreateAppointment={onCreateAppointment}
                          />
                        </div>
                      )}
                    </div>
                  </DroppableTimeSlot>
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
  );
}
