import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, FileText, Clock, Calendar, CheckCircle, User, MapPin, Loader2 } from "lucide-react";
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
  const pagination = usePagination({ initialPageSize: 50 });

  // Track presence for currently viewed service order
  useGenericPresence({
    recordId: selectedOrder,
    tableName: "service_orders",
    displayField: "title",
    moduleName: "Service Orders",
    numberField: "order_number",
  });

  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ["service_orders", searchTerm, statusFilter, priorityFilter, customerFilter, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      
      let query = supabase
        .from("service_orders")
        .select(`
          id,
          order_number,
          title,
          customer_id,
          status,
          priority,
          actual_cost,
          cost_of_labor,
          cost_of_materials,
          other_costs,
          completed_date,
          created_at,
          customers!service_orders_customer_id_fkey(name)
        `, { count: 'exact' })
        .order("created_at", { ascending: false });

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
      
      <div className="space-y-6">
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
                    { label: 'Total', value: `$${order.total_amount?.toFixed(2) || '0.00'}` },
                  ]}
                  onClick={() => window.location.href = `/service-orders/${order.id}`}
                />
              ))
            )}
          </div>
        ) : (
          /* Desktop Grid View - Beautiful cards */
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <Card className="border-none shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No orders found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map((order: any) => (
                  <Card 
                    key={order.id}
                    className="border-none shadow-md hover:shadow-lg hover-scale transition-all cursor-pointer group"
                    onClick={() => window.location.href = `/service-orders/${order.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg font-bold">#{order.order_number}</CardTitle>
                          <p className="text-sm text-muted-foreground line-clamp-1">{order.title}</p>
                        </div>
                        <Badge className={cn("shrink-0", statusColors[order.status as keyof typeof statusColors])}>
                          {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-foreground truncate">{order.customers?.name || '-'}</span>
                        </div>
                        {order.customer_locations?.name && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground truncate">{order.customer_locations.name}</span>
                          </div>
                        )}
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", priorityColors[order.priority as keyof typeof priorityColors])}>
                            {order.priority}
                          </Badge>
                        </div>
                         <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold">${order.total_amount?.toFixed(2) || '0.00'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
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