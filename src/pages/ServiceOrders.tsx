import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AuditDrawer from "@/components/audit/AuditDrawer";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export default function ServiceOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { onlineUsers, updateField } = usePresence({ page: "service-orders" });
  
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["service_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name),
          profiles!service_orders_assigned_to_fkey(first_name, last_name),
          project:customers!service_orders_project_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers_filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians_filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch = 
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customers?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter;
    const matchesAssigned = assignedFilter === "all" || order.assigned_to === assignedFilter;
    const matchesCustomer = customerFilter === "all" || order.customer_id === customerFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesAssigned && matchesCustomer;
  });

  const handleDelete = async () => {
    if (!orderToDelete) return;

    const { error } = await supabase
      .from("service_orders")
      .delete()
      .eq("id", orderToDelete);

    if (error) {
      toast({ 
        title: "Error deleting order", 
        description: error.message,
        variant: "destructive" 
      });
    } else {
      toast({ title: "Service order deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["service_orders"] });
      setSelectedOrder(null);
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  const handleEdit = (orderId: string) => {
    setEditingOrderId(orderId);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingOrderId(undefined);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingOrderId(undefined);
    }
  }, [dialogOpen]);

  const stats = {
    total: orders.length,
    draft: orders.filter((o: any) => o.status === "draft").length,
    scheduled: orders.filter((o: any) => o.status === "scheduled").length,
    inProgress: orders.filter((o: any) => o.status === "in_progress").length,
    completed: orders.filter((o: any) => o.status === "completed").length,
  };

  return (
    <DashboardLayout>
      <RemoteCursors users={onlineUsers} />
      
      {selectedOrder && (
        <AuditDrawer 
          tableName="service_orders" 
          recordId={selectedOrder}
          recordTitle={`Service Order ${orders.find((o: any) => o.id === selectedOrder)?.order_number}`}
        />
      )}

      <ServiceOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderId={editingOrderId}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Service Orders</h1>
            <p className="text-muted-foreground mt-2">
              Manage field service jobs and assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            <Button className="gap-2" onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <p className="text-sm text-muted-foreground mt-1">Total Orders</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{stats.draft}</div>
              <p className="text-sm text-muted-foreground mt-1">Draft</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-info">{stats.scheduled}</div>
              <p className="text-sm text-muted-foreground mt-1">Scheduled</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{stats.inProgress}</div>
              <p className="text-sm text-muted-foreground mt-1">In Progress</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{stats.completed}</div>
              <p className="text-sm text-muted-foreground mt-1">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number, customer, or title..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Technicians" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Technicians</SelectItem>
                    {technicians.map((tech: any) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>
              All Orders ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No orders found</div>
            ) : (
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
                        Project
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Priority
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Assigned
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Scheduled
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order: any) => (
                      <tr key={order.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-4 px-4">
                          <span className="font-medium">{order.order_number}</span>
                        </td>
                        <td className="py-4 px-4">{order.customers?.name || "-"}</td>
                        <td className="py-4 px-4">{order.title}</td>
                        <td className="py-4 px-4">
                          {order.project?.name ? (
                            <Badge variant="outline">{order.project.name}</Badge>
                          ) : "-"}
                        </td>
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
                          {order.profiles ? 
                            `${order.profiles.first_name} ${order.profiles.last_name}` : 
                            "-"
                          }
                        </td>
                        <td className="py-4 px-4">
                          {order.scheduled_date || "-"}
                        </td>
                        <td className="py-4 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(order.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedOrder(order.id)}>
                                View History
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setOrderToDelete(order.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}