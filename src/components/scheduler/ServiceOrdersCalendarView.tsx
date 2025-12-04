import { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import DroppableTimeSlot from "./DroppableTimeSlot";
import DroppableAppointmentCard from "./DroppableAppointmentCard";
import CreateAppointmentButton from "./CreateAppointmentButton";
import { CheckCircle, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ServiceOrdersCalendarViewProps {
  currentDate: Date;
  appointments: any[];
  viewType: "day" | "week" | "timegrid" | "month" | "kanban";
  stateFilter?: string;
  onAppointmentClick: (id: string) => void;
  onCreateAppointment: (serviceOrderId: string, date: Date, startTime: string, endTime: string) => void;
  onRemoveWorker: (appointmentId: string, workerId: string | null, contactId: string | null) => void;
}

type SortOption = "requires_appointment" | "name" | "number";

export default function ServiceOrdersCalendarView({
  currentDate,
  appointments,
  viewType,
  stateFilter = "all",
  onAppointmentClick,
  onCreateAppointment,
  onRemoveWorker,
}: ServiceOrdersCalendarViewProps) {
  const [sortBy, setSortBy] = useState<SortOption>("requires_appointment");
  // Fetch service orders with appointments and line items
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders-for-calendar", stateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name),
          service_order_line_items(*),
          customer_locations!service_orders_customer_location_id_fkey(state)
        `)
        .in("status", ["draft", "scheduled", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter by state if filter is applied
      let filteredData = data || [];
      if (stateFilter !== "all") {
        filteredData = filteredData.filter(order => 
          order.customer_locations?.state === stateFilter
        );
      }
      
      return filteredData;
    },
  });

  // Get date range based on view type
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Helper function to calculate scheduled hours from appointments
  const calculateScheduledHours = (orderAppointments: any[]) => {
    return orderAppointments.reduce((total, apt) => {
      const start = new Date(apt.start_time);
      const end = new Date(apt.end_time);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);
  };

  // Group appointments by service order and calculate summaries
  const appointmentsByServiceOrder = serviceOrders
    .map(order => {
      const lineItems = order.service_order_line_items || [];
      const lineItemsSummary = lineItems.length > 0
        ? lineItems
            .slice(0, 3)
            .map((item: any) => `${item.quantity}x ${item.description}`)
            .join(", ") + (lineItems.length > 3 ? "..." : "")
        : "";

      const orderAppointments = appointments.filter(apt => apt.service_order_id === order.id);
      const scheduledHours = calculateScheduledHours(orderAppointments);
      const isFulfilled = order.estimated_hours ? scheduledHours >= order.estimated_hours : false;

      return {
        ...order,
        appointments: orderAppointments,
        lineItemsSummary,
        scheduledHours,
        isFulfilled,
      };
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.title || "").localeCompare(b.title || "");
        case "number":
          return (a.order_number || "").localeCompare(b.order_number || "");
        case "requires_appointment":
        default:
          // Unfulfilled first (requires appointment), then fulfilled
          if (a.isFulfilled !== b.isFulfilled) {
            return a.isFulfilled ? 1 : -1;
          }
          // Secondary sort by preferred_date
          if (!a.preferred_date && !b.preferred_date) return 0;
          if (!a.preferred_date) return 1;
          if (!b.preferred_date) return -1;
          return new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime();
      }
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

  const isDateInPreferredRange = (order: any, day: Date) => {
    if (!order.preferred_date_start || !order.preferred_date_end) return false;
    
    const rangeStart = new Date(order.preferred_date_start);
    const rangeEnd = new Date(order.preferred_date_end);
    
    const isInRange = isWithinInterval(day, { start: rangeStart, end: rangeEnd });
    
    return isInRange;
  };

  const isPreferredDate = (order: any, day: Date) => {
    if (!order.preferred_date) return false;
    return isSameDay(day, new Date(order.preferred_date));
  };

  return (
    <div className="h-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header Row - Days */}
        <div className="grid grid-cols-8 gap-px bg-border flex-shrink-0 bg-background pb-px border-b">
          <div className="font-semibold text-sm p-2 bg-background">
            <div className="flex items-center gap-1">
              <span>Service Order</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <DropdownMenuRadioItem value="requires_appointment">
                      Requires Appointment
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="number">Service Order Number</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {days.map(day => (
            <div key={day.toISOString()} className="text-center font-semibold text-sm p-2 bg-background">
              <div>{format(day, "EEE")}</div>
              <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
            </div>
          ))}
        </div>

        {/* Service Order Rows */}
        <div className="space-y-px bg-border">
          {appointmentsByServiceOrder.map(order => (
            <div key={order.id} className="grid grid-cols-8 gap-px bg-border">
              {/* Service Order Info */}
              <Card className={cn(
                "p-2 flex flex-col justify-center border-0",
                order.isFulfilled ? "bg-green-50 dark:bg-green-950/30" : "bg-background"
              )}>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs w-fit">
                      {order.order_number}
                    </Badge>
                  </div>
                  <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                    {order.title}
                    {order.isFulfilled && (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
                    )}
                  </div>
                  {order.customers && (
                    <div className="text-xs text-muted-foreground truncate">
                      {order.customers.name}
                    </div>
                  )}
                  {order.estimated_hours && (
                    <div className={cn(
                      "text-xs flex items-center gap-1",
                      order.isFulfilled ? "text-green-600 dark:text-green-500 font-medium" : "text-muted-foreground"
                    )}>
                      {order.scheduledHours.toFixed(1)}h / {order.estimated_hours}h
                      {order.isFulfilled && <span className="text-[10px]">✓</span>}
                    </div>
                  )}
                </div>
              </Card>

              {/* Appointments for each day */}
              {days.map(day => {
                const dayAppointments = getAppointmentsForDay(order.id, day);
                const isInRange = isDateInPreferredRange(order, day);
                const isPreferred = isPreferredDate(order, day);
                
                return (
                  <DroppableTimeSlot
                    key={day.toISOString()}
                    id={`so-slot-${order.id}-${day.toISOString()}`}
                    date={day}
                    workerId={null}
                    className={cn(
                      "min-h-[120px] p-2",
                      // Only grey out empty cells on fulfilled orders
                      order.isFulfilled && dayAppointments.length === 0
                        ? "bg-muted/50" 
                        : "bg-background",
                      !order.isFulfilled && isInRange && "bg-yellow-100/60 dark:bg-yellow-900/30 border-2 border-yellow-200 dark:border-yellow-800",
                      !order.isFulfilled && isPreferred && "!border-green-500 dark:!border-green-600 !border-2"
                    )}
                  >
                    <div className="space-y-2 h-full">
                      {dayAppointments.length > 0 ? (
                        dayAppointments.map(apt => (
                          <DroppableAppointmentCard
                            key={apt.id}
                            appointment={apt}
                            lineItemsSummary={order.lineItemsSummary}
                            estimatedHours={order.estimated_hours}
                            onRemoveWorker={(workerId, contactId) => onRemoveWorker(apt.id, workerId, contactId)}
                            onClick={() => onAppointmentClick(apt.id)}
                          />
                        ))
                      ) : !order.isFulfilled ? (
                        <div className="h-full flex items-center justify-center">
                          <CreateAppointmentButton
                            serviceOrderId={order.id}
                            serviceOrderTitle={order.title}
                            date={day}
                            onCreateAppointment={onCreateAppointment}
                          />
                        </div>
                      ) : null}
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
