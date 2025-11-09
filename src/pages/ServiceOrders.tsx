import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AuditDrawer from "@/components/audit/AuditDrawer";

const mockOrders = [
  {
    id: "1",
    orderNumber: "SO-2024001",
    customer: "Acme Corporation",
    title: "HVAC Installation",
    status: "scheduled",
    priority: "high",
    scheduledDate: "2024-01-15",
    billingType: "fixed",
    amount: "$2,500",
  },
  {
    id: "2",
    orderNumber: "SO-2024002",
    customer: "Best Tech Inc",
    title: "Flooring Repair",
    status: "in_progress",
    priority: "normal",
    scheduledDate: "2024-01-14",
    billingType: "hourly",
    amount: "$85/hr",
  },
  {
    id: "3",
    orderNumber: "SO-2024003",
    customer: "Metro Services",
    title: "Plumbing Inspection",
    status: "draft",
    priority: "low",
    scheduledDate: null,
    billingType: "both",
    amount: "$150 + $50/hr",
  },
];

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export default function ServiceOrders() {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  return (
    <DashboardLayout>
      {selectedOrder && (
        <AuditDrawer 
          tableName="service_orders" 
          recordId={selectedOrder}
          recordTitle={`Service Order ${mockOrders.find(o => o.id === selectedOrder)?.orderNumber}`}
        />
      )}
      
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Service Orders</h1>
            <p className="text-muted-foreground mt-2">
              Manage field service jobs and assignments
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Search Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number, customer, or title..."
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>All Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Order #
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Title
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Priority
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Scheduled
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Billing
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-medium">{order.orderNumber}</span>
                      </td>
                      <td className="py-4 px-4">{order.customer}</td>
                      <td className="py-4 px-4">{order.title}</td>
                      <td className="py-4 px-4">
                        <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={priorityColors[order.priority as keyof typeof priorityColors]}>
                          {order.priority}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        {order.scheduledDate || "-"}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <span className="text-sm text-muted-foreground capitalize">{order.billingType}</span>
                          <div className="font-medium">{order.amount}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order.id)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
