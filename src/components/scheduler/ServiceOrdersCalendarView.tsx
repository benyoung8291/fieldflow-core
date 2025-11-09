import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DroppableTimeSlot from "./DroppableTimeSlot";
import { cn } from "@/lib/utils";

interface ServiceOrdersCalendarViewProps {
  currentDate: Date;
  appointments: any[];
  viewType: "calendar" | "kanban" | "service-orders";
  onAppointmentClick: (id: string) => void;
}

export default function ServiceOrdersCalendarView({
  currentDate,
  appointments,
  viewType,
  onAppointmentClick
}: ServiceOrdersCalendarViewProps) {
  // Fetch service orders with appointments
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders-for-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name)
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

  // Group appointments by service order
  const appointmentsByServiceOrder = serviceOrders.map(order => ({
    ...order,
    appointments: appointments.filter(apt => apt.service_order_id === order.id)
  }));

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
    <div className="overflow-x-auto">
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
                    className="min-h-[80px]"
                  >
                    {dayAppointments.length > 0 ? (
                      <div className="space-y-1">
                        {dayAppointments.map(apt => {
                          const workers = apt.appointment_workers || [];
                          return (
                            <Card
                              key={apt.id}
                              className="p-2 cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => onAppointmentClick(apt.id)}
                            >
                              <div className="space-y-1">
                                {workers.length > 0 ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <User className="h-3 w-3" />
                                    <span className="truncate">
                                      {workers.map((w: any) => 
                                        `${w.profiles?.first_name || ''} ${w.profiles?.last_name || ''}`
                                      ).join(', ')}
                                    </span>
                                  </div>
                                ) : apt.profiles && (
                                  <div className="flex items-center gap-1 text-xs">
                                    <User className="h-3 w-3" />
                                    <span className="truncate">
                                      {apt.profiles.first_name} {apt.profiles.last_name}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold">
                                  {calculateTotalHours(apt.start_time, apt.end_time)}h
                                </div>
                                <Badge 
                                  variant={apt.status === "completed" ? "default" : "secondary"}
                                  className="text-xs w-fit"
                                >
                                  {apt.status}
                                </Badge>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        -
                      </div>
                    )}
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
