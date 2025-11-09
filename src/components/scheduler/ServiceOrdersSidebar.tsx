import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import DraggableServiceOrder from "./DraggableServiceOrder";
import { differenceInHours } from "date-fns";

export default function ServiceOrdersSidebar() {
  const { data: serviceOrdersWithAppointments = [], error } = useQuery({
    queryKey: ["service-orders-with-appointments"],
    queryFn: async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name),
          appointments(id, start_time, end_time, status)
        `)
        .in("status", ["draft", "scheduled", "in_progress"])
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Error fetching service orders:", ordersError);
        throw ordersError;
      }

      // Calculate remaining hours for each service order
      return orders.map(order => {
        const estimatedHours = order.estimated_hours || 0;
        
        // Calculate total scheduled hours from appointments
        const scheduledHours = (order.appointments || [])
          .filter((apt: any) => apt.status !== "cancelled")
          .reduce((total: number, apt: any) => {
            const hours = differenceInHours(
              new Date(apt.end_time),
              new Date(apt.start_time)
            );
            return total + hours;
          }, 0);

        const remainingHours = Math.max(0, estimatedHours - scheduledHours);

        return {
          ...order,
          scheduledHours,
          remainingHours,
        };
      });
    },
  });

  // Filter to only show service orders that need more appointments
  const ordersNeedingAppointments = serviceOrdersWithAppointments.filter(
    order => order.remainingHours > 0
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">
          Service Orders Needing Appointments
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag orders to calendar to create appointments
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)] px-4 pb-4">
          <div className="space-y-2">
            {ordersNeedingAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                All service orders have sufficient appointments scheduled
              </div>
            ) : (
              ordersNeedingAppointments.map((order) => (
                <DraggableServiceOrder
                  key={order.id}
                  serviceOrder={order}
                  remainingHours={order.remainingHours}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
