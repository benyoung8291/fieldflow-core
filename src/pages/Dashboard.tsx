import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Users, Calendar, FileText, Briefcase, DollarSign, CheckSquare, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfMonth, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { TodaysTasks } from "@/components/dashboard/TodaysTasks";
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
      <div className="space-y-6 pt-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.name}
                variant="outline"
                className="h-auto flex flex-col items-center gap-2 p-4 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-border/50 bg-card"
                onClick={action.onClick}
              >
                <div className={`p-2.5 rounded-xl ${action.bgColor}`}>
                  <Icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <p className="text-xs font-medium text-foreground">{action.name}</p>
              </Button>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      <div className="h-2 w-20 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.name} className="hover:shadow-lg transition-all duration-200 border-border/50 bg-gradient-to-br from-card to-card/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                        <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs text-muted-foreground font-medium">{stat.change}</p>
                      </div>
                      <div className={`p-3 rounded-xl bg-gradient-to-br from-background/50 to-background`}>
                        <Icon className={`h-6 w-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Content Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Orders */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
              {ordersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No service orders yet
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((order: any) => (
                    <div 
                      key={order.id} 
                      onClick={() => navigate(`/service-orders/${order.id}`)}
                      className="flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-lg hover:bg-muted/50 hover:shadow-md cursor-pointer transition-all duration-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {order.customers?.name || "Unknown"}
                        </p>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize
                          ${order.status === 'completed' ? 'bg-success/10 text-success border border-success/20' : 
                            order.status === 'in_progress' ? 'bg-warning/10 text-warning border border-warning/20' : 
                            'bg-muted text-muted-foreground border border-border'}`}>
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
          <Card className="border-border/50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Today's Schedule</h3>
              {scheduleLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : todaySchedule.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No appointments today
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySchedule.map((appointment: any) => (
                    <div 
                      key={appointment.id} 
                      onClick={() => navigate(`/scheduler?appointment=${appointment.id}`)}
                      className="flex items-center gap-3 p-4 bg-muted/30 border border-border/50 rounded-lg hover:bg-muted/50 hover:shadow-md cursor-pointer transition-all duration-200"
                    >
                      <div className="text-xs font-bold text-primary bg-primary/10 px-3 py-2 rounded-lg flex-shrink-0 border border-primary/20">
                        {format(new Date(appointment.start_time), "hh:mm a")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{appointment.title}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{appointment.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Tasks */}
        <Card className="border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Today's Tasks</h3>
            <TodaysTasks />
          </CardContent>
        </Card>
      </div>
      <PerrAIAssistant />
    </DashboardLayout>
  );
}
