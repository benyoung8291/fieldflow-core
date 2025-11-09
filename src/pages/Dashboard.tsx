import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, Calendar, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";

export default function Dashboard() {
  // Fetch dashboard statistics
  const { data: stats = [], isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const monthStart = startOfMonth(today);

      // Count active service orders
      const { count: activeOrders } = await supabase
        .from("service_orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["draft", "scheduled", "in_progress"]);

      // Count total customers
      const { count: totalCustomers } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Count today's appointments
      const { count: todayAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("start_time", startOfDay(today).toISOString())
        .lte("start_time", endOfDay(today).toISOString());

      // Calculate revenue (from quotes converted this month)
      const { data: quotes } = await supabase
        .from("quotes")
        .select("total_amount")
        .eq("status", "approved")
        .gte("approved_at", monthStart.toISOString());

      const revenue = quotes?.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0) || 0;

      return [
        {
          name: "Active Orders",
          value: (activeOrders || 0).toString(),
          change: "Current",
          icon: ClipboardList,
          color: "text-primary",
        },
        {
          name: "Total Customers",
          value: (totalCustomers || 0).toString(),
          change: "Active",
          icon: Users,
          color: "text-success",
        },
        {
          name: "Appointments",
          value: (todayAppointments || 0).toString(),
          change: "Today",
          icon: Calendar,
          color: "text-warning",
        },
        {
          name: "Revenue (MTD)",
          value: `$${revenue.toLocaleString()}`,
          change: "This month",
          icon: TrendingUp,
          color: "text-info",
        },
      ];
    },
  });

  // Fetch recent service orders
  const { data: recentOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["recent-service-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          id,
          order_number,
          status,
          customers (name)
        `)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch today's appointments
  const { data: todaySchedule = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ["today-schedule"],
    queryFn: async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from("appointments")
        .select("id, title, start_time, status")
        .gte("start_time", startOfDay(today).toISOString())
        .lte("start_time", endOfDay(today).toISOString())
        .order("start_time", { ascending: true })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's an overview of your operations.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
                  <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))
          ) : (
            stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.name} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.name}
                    </CardTitle>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.change}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Recent Service Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No service orders yet</p>
                  <p className="text-sm">Create your first order to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.customers?.name || "Unknown Customer"}
                        </p>
                      </div>
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary capitalize">
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : todaySchedule.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No appointments today</p>
                  <p className="text-sm">Schedule is clear</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todaySchedule.map((appointment: any) => (
                    <div key={appointment.id} className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <div className="text-sm font-medium text-primary">
                        {format(new Date(appointment.start_time), "hh:mm a")}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{appointment.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{appointment.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
