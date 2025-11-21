import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Users, Calendar, FileText, Briefcase, DollarSign, CheckSquare, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { TodaysTasks } from "@/components/dashboard/TodaysTasks";
import { ActivityAndUsers } from "@/components/dashboard/ActivityAndUsers";
import { PerrAIAssistant } from "@/components/dashboard/PerrAIAssistant";

export default function Dashboard() {
  const navigate = useNavigate();

  const quickActions = [
    {
      name: "Order",
      icon: ClipboardList,
      color: "text-primary",
      bgColor: "bg-primary/10",
      onClick: () => navigate("/service-orders"),
    },
    {
      name: "Appointment",
      icon: Calendar,
      color: "text-warning",
      bgColor: "bg-warning/10",
      onClick: () => navigate("/scheduler"),
    },
    {
      name: "Quote",
      icon: FileText,
      color: "text-info",
      bgColor: "bg-info/10",
      onClick: () => navigate("/quotes"),
    },
    {
      name: "Project",
      icon: Briefcase,
      color: "text-success",
      bgColor: "bg-success/10",
      onClick: () => navigate("/projects"),
    },
    {
      name: "Invoice",
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      onClick: () => navigate("/invoices"),
    },
    {
      name: "Task",
      icon: CheckSquare,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      onClick: () => navigate("/tasks"),
    },
  ];

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
          color: "text-info",
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
          customers!service_orders_customer_id_fkey (name)
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
    <DashboardLayout showRightSidebar={true}>
      <div className="space-y-3">
        {/* Quick Actions - Compact */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.name}
                variant="outline"
                className="h-auto flex flex-col items-center gap-1.5 p-2 hover:shadow-sm transition-all"
                onClick={action.onClick}
              >
                <div className={`p-1.5 rounded ${action.bgColor}`}>
                  <Icon className={`h-4 w-4 ${action.color}`} />
                </div>
                <p className="text-xs font-medium">{action.name}</p>
              </Button>
            );
          })}
        </div>

        {/* Stats Grid - Compact */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                      <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                      <div className="h-2 w-16 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.name} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <p className="text-xs text-muted-foreground">{stat.name}</p>
                        <p className="text-xl font-bold">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.change}</p>
                      </div>
                      <Icon className={`h-8 w-8 ${stat.color} opacity-80`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Content Grid - Optimized */}
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Recent Orders */}
          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-2">Recent Orders</h3>
              {ordersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No service orders yet
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((order: any) => (
                    <div 
                      key={order.id} 
                      onClick={() => navigate(`/service-orders/${order.id}`)}
                      className="flex items-center justify-between p-2 bg-muted/40 border rounded hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.customers?.name || "Unknown"}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize
                          ${order.status === 'completed' ? 'bg-success/10 text-success' : 
                            order.status === 'in_progress' ? 'bg-warning/10 text-warning' : 
                            'bg-muted text-muted-foreground'}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-2">Today's Schedule</h3>
              {scheduleLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : todaySchedule.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No appointments today
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySchedule.map((appointment: any) => (
                    <div 
                      key={appointment.id} 
                      onClick={() => navigate(`/scheduler?appointment=${appointment.id}`)}
                      className="flex items-center gap-2 p-2 bg-muted/40 border rounded hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded flex-shrink-0">
                        {format(new Date(appointment.start_time), "hh:mm a")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{appointment.title}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{appointment.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Tasks - Full Width */}
        <Card>
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold mb-2">Today's Tasks</h3>
            <TodaysTasks />
          </CardContent>
        </Card>
      </div>
      <PerrAIAssistant />
    </DashboardLayout>
  );
}
