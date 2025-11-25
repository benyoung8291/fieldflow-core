import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, FileText, Clock, Calendar, CheckCircle, User, MapPin, Loader2, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
import { usePagination } from "@/hooks/usePagination";
import { useGenericPresence } from "@/hooks/useGenericPresence";
import { ModuleTutorial } from "@/components/onboarding/ModuleTutorial";
import { TUTORIAL_CONTENT } from "@/data/tutorialContent";

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<'order_number' | 'created_at' | 'preferred_date' | 'customer'>('order_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const pagination = usePagination({ initialPageSize: 50 });

  // Track presence for currently viewed service order
  useGenericPresence({
    recordId: selectedOrder,
    tableName: "service_orders",
    displayField: "title",
    moduleName: "Service Orders",
    numberField: "order_number",
  });

  // Set up realtime updates for appointments to refresh counts
  useEffect(() => {
    const channel = supabase
      .channel('service-orders-appointments-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        () => {
          console.log('[ServiceOrders] Appointment changed, refreshing service orders');
          queryClient.invalidateQueries({ queryKey: ["service_orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ["service_orders", searchTerm, statusFilter, priorityFilter, customerFilter, sortField, sortDirection, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      
      let query = supabase
        .from("service_orders")
        .select(`
          id,
          order_number,
          work_order_number,
          title,
          customer_id,
          location_id,
          status,
          priority,
          subtotal,
          completed_date,
          created_at,
          preferred_date,
          customers!service_orders_customer_id_fkey(name),
          customer_locations!service_orders_location_id_fkey(name),
          appointments(count),
          purchase_orders(count),
          invoices(count)
        `, { count: 'exact' });

      // Apply sorting - special handling for customer name
      if (sortField === 'customer') {
        query = query.order("customers(name)", { ascending: sortDirection === 'asc' });
      } else {
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
      }

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }
      if (customerFilter !== "all") {
        query = query.eq("customer_id", customerFilter);
      }

      // Apply search filter across all records
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        query = query.or(`order_number.ilike.%${searchLower}%,title.ilike.%${searchLower}%,work_order_number.ilike.%${searchLower}%`);
      }

      // Apply pagination after filters
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error("Error fetching service orders:", error);
        throw error;
      }
      return { orders: data || [], count: count || 0 };
    },
  });

  const orders = ordersResponse?.orders || [];
  const totalCount = ordersResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

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

  // No need for client-side filtering since we're filtering in the database query

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
      <ModuleTutorial 
        moduleName="service_orders"
        defaultSteps={TUTORIAL_CONTENT.service_orders.steps}
        title={TUTORIAL_CONTENT.service_orders.title}
        description={TUTORIAL_CONTENT.service_orders.description}
      />
      
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
      
      <div className="space-y-6 pt-6">
        {/* Header with clean modern design */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Service Orders</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and track all your field service jobs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PresenceIndicator users={onlineUsers} />
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        {/* Stats - Modern card design with better visual hierarchy */}
        {!isMobile && (
          <div className="grid grid-cols-5 gap-4">
            <Card className="border-none shadow-sm hover-scale transition-all">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                    <p className="text-3xl font-bold mt-2">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm hover-scale transition-all">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Waiting</p>
                    <p className="text-3xl font-bold mt-2">{stats.draft}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm hover-scale transition-all">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                    <p className="text-3xl font-bold mt-2 text-info">{stats.scheduled}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm hover-scale transition-all">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                    <p className="text-3xl font-bold mt-2 text-warning">{stats.inProgress}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm hover-scale transition-all">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed</p>
                    <p className="text-3xl font-bold mt-2 text-success">{stats.completed}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters - Modern elevated design */}
        <Card className="border-none shadow-md">
          <CardContent className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by number, customer, or title..."
                className="pl-10 h-11 border-none bg-muted/50"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  pagination.resetPage();
                }}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 border-none bg-muted/50">
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
                <SelectTrigger className="h-10 border-none bg-muted/50">
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
                <SelectTrigger className="h-10 border-none bg-muted/50">
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

            {/* Quick Sort Options */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={sortField === 'order_number' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (sortField === 'order_number') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('order_number');
                      setSortDirection('desc');
                    }
                  }}
                  className="gap-1.5"
                >
                  Order #
                  {sortField === 'order_number' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortField === 'created_at' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (sortField === 'created_at') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('created_at');
                      setSortDirection('desc');
                    }
                  }}
                  className="gap-1.5"
                >
                  Created
                  {sortField === 'created_at' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortField === 'preferred_date' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (sortField === 'preferred_date') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('preferred_date');
                      setSortDirection('asc');
                    }
                  }}
                  className="gap-1.5"
                >
                  Preferred Date
                  {sortField === 'preferred_date' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortField === 'customer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (sortField === 'customer') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('customer');
                      setSortDirection('asc');
                    }
                  }}
                  className="gap-1.5"
                >
                  Customer
                  {sortField === 'customer' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Grid - Modern card-based layout */}
        {isMobile ? (
          /* Mobile View */
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <Card className="border-none shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No orders found</p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order: any) => (
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
                    { label: 'Total', value: `$${order.subtotal?.toFixed(2) || '0.00'}` },
                  ]}
                  onClick={() => window.location.href = `/service-orders/${order.id}`}
                />
              ))
            )}
          </div>
        ) : (
          /* Desktop List View */
          <Card className="border-none shadow-md overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Order #</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Title</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Customer</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Location</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Appointments</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">POs</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Invoiced</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Priority</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Total (ex GST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order: any) => (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => window.location.href = `/service-orders/${order.id}`}
                      >
                        <td className="p-3">
                          <div className="text-sm font-semibold text-foreground">#{order.order_number}</div>
                          {order.work_order_number && (
                            <div className="text-xs text-muted-foreground">WO: {order.work_order_number}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="text-sm font-medium text-foreground truncate max-w-[300px]">{order.title}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-foreground truncate max-w-[200px]">{order.customers?.name || '-'}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {order.customer_locations?.name || '-'}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {order.appointments?.[0]?.count || 0}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {order.purchase_orders?.[0]?.count || 0}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          {(order.invoices?.[0]?.count || 0) > 0 ? (
                            <CheckCircle className="h-4 w-4 text-success mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={cn("text-xs", priorityColors[order.priority as keyof typeof priorityColors])}>
                            {order.priority}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={cn("text-xs", statusColors[order.status as keyof typeof statusColors])}>
                            {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="text-sm font-bold">${(order.subtotal || 0).toFixed(2)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Pagination Controls */}
        {!isMobile && totalPages > 1 && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} orders
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pagination.prevPage()}
                    disabled={pagination.currentPage === 0}
                  >
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.currentPage + 1} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pagination.nextPage()}
                    disabled={pagination.currentPage >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}