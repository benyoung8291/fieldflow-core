import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, Calendar, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const stats = [
    {
      name: "Active Orders",
      value: "24",
      change: "+12%",
      icon: ClipboardList,
      color: "text-primary",
    },
    {
      name: "Total Customers",
      value: "156",
      change: "+8%",
      icon: Users,
      color: "text-success",
    },
    {
      name: "Appointments",
      value: "18",
      change: "Today",
      icon: Calendar,
      color: "text-warning",
    },
    {
      name: "Revenue (MTD)",
      value: "$42,350",
      change: "+15%",
      icon: TrendingUp,
      color: "text-info",
    },
  ];

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
          {stats.map((stat) => {
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
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Recent Service Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">SO-{2024000 + i}</p>
                      <p className="text-sm text-muted-foreground">Customer {i}</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      Scheduled
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: "09:00 AM", task: "Install HVAC System" },
                  { time: "01:00 PM", task: "Maintenance Check" },
                  { time: "03:30 PM", task: "Flooring Inspection" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="text-sm font-medium text-primary">{item.time}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
