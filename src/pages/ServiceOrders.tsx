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
import { usePresence } from "@/hooks/usePresence";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

const statusLabels: Record<string, string> = {
  draft: "Waiting",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
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
  const { isMobile } = useViewMode();
  const { onlineUsers, updateField } = usePresence({ page: "service-orders" });
  
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["service_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching service orders:", error);
        throw error;
      }
      return data || [];
    },
  });

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
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

  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch = 
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter;
    const matchesCustomer = customerFilter === "all" || order.customer_id === customerFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesCustomer;
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
      <div ref={containerRef} className="relative h-full overflow-y-auto">
        <PullToRefreshIndicator
          isPulling={isPulling}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          threshold={threshold}
        />
      
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
      
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage field service jobs and assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            <Button size="sm" className="gap-2 h-8" onClick={handleCreate}>
              <Plus className="h-3.5 w-3.5" />
              New Order
            </Button>
          </div>
        </div>

        {/* Stats - Compact - Hide on mobile */}
        {!isMobile && (
          <div className="grid grid-cols-5 gap-2">
          <Card className="shadow-sm">
            <CardContent className="pt-3 pb-2 px-3">
              <div className="text-xl font-bold text-foreground">{stats.total}</div>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-3 pb-2 px-3">
              <div className="text-xl font-bold text-muted-foreground">{stats.draft}</div>
              <p className="text-[10px] text-muted-foreground">Waiting</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-3 pb-2 px-3">
              <div className="text-xl font-bold text-info">{stats.scheduled}</div>
              <p className="text-[10px] text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-3 pb-2 px-3">
              <div className="text-xl font-bold text-warning">{stats.inProgress}</div>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-3 pb-2 px-3">
              <div className="text-xl font-bold text-success">{stats.completed}</div>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Search and Filters - Compact */}
        <Card className="shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by order number, customer, or title..."
                className="pl-8 h-8 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Waiting</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 text-xs">
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

              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-8 text-xs">
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
          </CardContent>
        </Card>

        {/* Orders List */}
        {isMobile ? (
          /* Mobile Card View */
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-6 text-muted-foreground">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No orders found</div>
            ) : (
              filteredOrders.map((order: any) => (
                <MobileDocumentCard
                  key={order.id}
                  title={`#${order.order_number}`}
                  subtitle={order.title}
                  status={statusLabels[order.status as keyof typeof statusLabels] || order.status}
                  statusColor={
                    order.status === 'draft' ? 'bg-muted-foreground' :
                    order.status === 'scheduled' ? 'bg-info' :
                    order.status === 'in_progress' ? 'bg-warning' :
                    'bg-success'
                  }
                  badge={order.priority}
                  badgeVariant={
                    order.priority === 'urgent' ? 'destructive' :
                    order.priority === 'high' ? 'default' :
                    'secondary'
                  }
                  metadata={[
                    { label: 'Customer', value: order.customers?.name || '-' },
                    { label: 'Location', value: order.customer_locations?.name || '-' },
                    ...(order.work_order_number ? [{ label: 'WO#', value: order.work_order_number }] : []),
                    { label: 'Total', value: `$${order.total_amount?.toFixed(2) || '0.00'}` },
                  ]}
                  onClick={() => window.location.href = `/service-orders/${order.id}`}
                />
              ))
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <Card className="shadow-sm">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">
              All Orders ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-6 text-xs text-muted-foreground">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No orders found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Order #
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Title
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Location
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                        Total
                      </th>
                      <th className="text-right py-1.5 px-2 font-medium text-muted-foreground text-[10px] uppercase tracking-wider w-16">
                        
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredOrders.map((order: any) => (
                      <tr 
                        key={order.id} 
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/service-orders/${order.id}`}
                      >
                        <td className="py-1 px-2">
                          <div className="font-medium text-[11px]">{order.order_number}</div>
                          {order.work_order_number && (
                            <div className="text-[9px] text-muted-foreground">WO: {order.work_order_number}</div>
                          )}
                        </td>
                        <td className="py-1 px-2 text-[11px]">{order.customers?.name || "-"}</td>
                        <td className="py-1 px-2">
                          <div className="text-[11px]">{order.title}</div>
                          {order.skill_required && (
                            <div className="text-[9px] text-muted-foreground">Skill: {order.skill_required}</div>
                          )}
                        </td>
                        <td className="py-1 px-2 text-[11px]">
                          {order.customer_locations?.name || "-"}
                        </td>
                        <td className="py-1 px-2">
                          <Badge variant="outline" className={`text-[9px] py-0 px-1 ${statusColors[order.status as keyof typeof statusColors]}`}>
                            {statusLabels[order.status as keyof typeof statusLabels] || order.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-1 px-2">
                          <Badge variant="outline" className={`text-[9px] py-0 px-1 ${priorityColors[order.priority as keyof typeof priorityColors]}`}>
                            {order.priority}
                          </Badge>
                        </td>
                        <td className="py-1 px-2 text-right text-[11px] font-medium">
                          ${order.total_amount?.toFixed(2) || "0.00"}
                        </td>
                        <td className="py-1 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem onClick={() => handleEdit(order.id)}>
                                <Edit className="h-3 w-3 mr-2" />
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
                                <Trash2 className="h-3 w-3 mr-2" />
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
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}