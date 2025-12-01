import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Building2, Users, FileText, Upload, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CustomerDialog from "@/components/customers/CustomerDialog";
import CustomerImportDialog from "@/components/customers/CustomerImportDialog";
import { useNavigate } from "react-router-dom";
import { usePresence } from "@/hooks/usePresence";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { usePagination } from "@/hooks/usePagination";
import { ModuleTutorial } from "@/components/onboarding/ModuleTutorial";
import { TUTORIAL_CONTENT } from "@/data/tutorialContent";
import { PermissionButton, PermissionGate } from "@/components/permissions";

export default function Customers() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const pagination = usePagination({ initialPageSize: 50 });
  
  const { onlineUsers, updateCursorPosition } = usePresence({
    page: "customers-list",
  });

  // Fetch customers from database
  const { data: customersResponse, isLoading, refetch } = useQuery({
    queryKey: ["customers", searchQuery, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      let query = supabase
        .from("customers")
        .select(`
          id,
          name,
          email,
          phone,
          abn,
          abn_validation_status,
          abn_validation_error,
          city,
          state,
          customer_type,
          is_active,
          parent_customer_id,
          trading_name,
          created_at
        `, { count: 'exact' })
        .order("name");

      // Apply search filter across all records
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        query = query.or(`name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchQuery}%,abn.ilike.%${searchLower}%,trading_name.ilike.%${searchLower}%`);
      }

      // Apply pagination after filters
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
  
  const customers = customersResponse?.data || [];
  const totalCount = customersResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  // Fetch service orders count for each customer
  const { data: serviceOrderCounts = {} } = useQuery({
    queryKey: ["customer-service-order-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("customer_id");
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(order => {
        counts[order.customer_id] = (counts[order.customer_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Fetch sub-accounts count (customers with parent_customer_id)
  const { data: subAccountCounts = {} } = useQuery({
    queryKey: ["customer-sub-account-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("parent_customer_id");
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(customer => {
        if (customer.parent_customer_id) {
          counts[customer.parent_customer_id] = (counts[customer.parent_customer_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Fetch total active customers count independently
  const { data: customerStats = { totalActive: 0 } } = useQuery({
    queryKey: ["customers_stats"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: 'exact', head: true })
        .eq("is_active", true);
      
      if (error) throw error;
      
      return { totalActive: count || 0 };
    },
  });

  // No need for client-side filtering since we're filtering in the database query

  const totalServiceOrders = Object.values(serviceOrderCounts).reduce((sum: number, count) => sum + (count as number), 0);
  const totalSubAccounts = Object.values(subAccountCounts).reduce((sum: number, count) => sum + (count as number), 0);

  // Track mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [updateCursorPosition]);

  const handleEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  return (
    <DashboardLayout>
      <ModuleTutorial 
        moduleName="customers"
        defaultSteps={TUTORIAL_CONTENT.customers.steps}
        title={TUTORIAL_CONTENT.customers.title}
        description={TUTORIAL_CONTENT.customers.description}
      />
      
      <div ref={containerRef} className="relative h-full overflow-y-auto">
        <PullToRefreshIndicator
          isPulling={isPulling}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          threshold={threshold}
        />
        <div className="space-y-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Customers</h1>
              <p className="text-muted-foreground mt-2">
                Manage customer accounts, contacts, and billing information
              </p>
            </div>
            <PresenceIndicator users={onlineUsers} />
          </div>
          <div className="flex gap-2">
            <PermissionButton
              module="customers"
              permission="import"
              onClick={() => setIsImportDialogOpen(true)}
              variant="outline"
              className="gap-2"
              hideIfNoPermission={true}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </PermissionButton>
            <PermissionButton
              module="customers"
              permission="create"
              onClick={handleAddNew}
              className="gap-2"
              hideIfNoPermission={true}
            >
              <Plus className="h-4 w-4" />
              New Customer
            </PermissionButton>
          </div>
        </div>

        {/* Stats */}
        {!isMobile && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customerStats.totalActive}</div>
                <p className="text-xs text-muted-foreground">All active accounts</p>
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sub-Accounts</CardTitle>
                <Users className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSubAccounts}</div>
                <p className="text-xs text-muted-foreground">Linked accounts</p>
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <FileText className="h-4 w-4 text-info" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalServiceOrders}</div>
                <p className="text-xs text-muted-foreground">Service orders</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Search Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ABN, email, or phone..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  pagination.resetPage();
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "No customers found matching your search" : "No customers yet. Click 'New Customer' to add one."}
              </p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-3">
            {customers.map((customer) => (
              <MobileDocumentCard
                key={customer.id}
                title={customer.name}
                subtitle={customer.trading_name && customer.trading_name !== customer.name ? `T/A ${customer.trading_name}` : undefined}
                badge={customer.is_active ? "Active" : "Inactive"}
                badgeVariant={customer.is_active ? "default" : "secondary"}
                metadata={[
                  { 
                    label: "ABN", 
                    value: customer.abn ? (
                      <div className="flex items-center gap-2">
                        <span>{customer.abn}</span>
                        {customer.abn_validation_status === 'pending' && (
                          <Badge variant="outline" className="text-xs">Validating</Badge>
                        )}
                        {customer.abn_validation_status === 'valid' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        )}
                        {customer.abn_validation_status === 'invalid' && (
                          <Badge variant="destructive" className="text-xs">Needs Review</Badge>
                        )}
                      </div>
                    ) : "-" 
                  },
                  { label: "Contact", value: customer.email || customer.phone || "-" },
                  { label: "Location", value: customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.city || customer.state || "-" },
                  { label: "Orders", value: serviceOrderCounts[customer.id] || 0 },
                ]}
                onClick={() => handleViewDetails(customer.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>All Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        ABN
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Contact
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Orders
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Sub-Accounts
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(customer.id)}
                      >
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.trading_name && customer.trading_name !== customer.name && (
                              <div className="text-sm text-muted-foreground">
                                T/A {customer.trading_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{customer.abn || '-'}</span>
                            {customer.abn_validation_status === 'pending' && (
                              <Badge variant="outline" className="text-xs">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Validating
                              </Badge>
                            )}
                            {customer.abn_validation_status === 'valid' && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                            {customer.abn_validation_status === 'invalid' && (
                              <Badge variant="destructive" className="text-xs">
                                Needs Review
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">{customer.email || '-'}</div>
                          <div className="text-sm text-muted-foreground">{customer.phone || '-'}</div>
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {customer.city && customer.state 
                            ? `${customer.city}, ${customer.state}` 
                            : customer.city || customer.state || '-'}
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline">{serviceOrderCounts[customer.id] || 0}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          {subAccountCounts[customer.id] ? (
                            <Badge variant="secondary">{subAccountCounts[customer.id]}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {customer.is_active ? (
                            <Badge className="bg-success/10 text-success">Active</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <PermissionButton
                            module="customers"
                            permission="edit"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(customer);
                            }}
                            hideIfNoPermission={true}
                          >
                            Edit
                          </PermissionButton>
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
          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} customers
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => pagination.prevPage()} disabled={pagination.currentPage === 0}>
                Previous
              </Button>
              <div className="text-sm">Page {pagination.currentPage + 1} of {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => pagination.nextPage()} disabled={pagination.currentPage >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customer={selectedCustomer}
      />

      <CustomerImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={() => refetch()}
      />
      </div>
    </DashboardLayout>
  );
}
