import { useState } from "react";
import { useLogListPageAccess } from "@/hooks/useLogDetailPageAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { usePagination } from "@/hooks/usePagination";
import { PermissionButton } from "@/components/permissions/PermissionButton";

export default function InvoicesList() {
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const pagination = usePagination({ initialPageSize: 50 });

  // Log list page access for audit trail
  useLogListPageAccess('invoices');

  const { data: invoicesResponse, isLoading, refetch } = useQuery({
    queryKey: ["invoices", searchQuery, statusFilter, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      
      let query = supabase
        .from("invoices")
        .select(`
          *,
          customers (
            id,
            name
          )
        `, { count: 'exact' })
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply search filter across all records
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        query = query.or(`invoice_number.ilike.%${searchLower}%`);
      }

      // Apply pagination after filters
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { invoices: data || [], count: count || 0 };
    },
  });

  const invoices = invoicesResponse?.invoices || [];
  const totalCount = invoicesResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  // No need for client-side filtering since we're filtering in the database query

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      sent: "secondary",
      approved: "default",
      paid: "default",
      overdue: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
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
        <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Invoices</h1>
            <p className="text-muted-foreground">Manage and track all customer invoices</p>
          </div>
          <PermissionButton 
            module="invoices" 
            permission="create"
            asChild
          >
            <Link to="/invoices/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Link>
          </PermissionButton>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number or customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                pagination.resetPage();
              }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

{isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading invoices...</p>
          </div>
        ) : invoices?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No invoices found</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {invoices?.map((invoice) => (
              <MobileDocumentCard
                key={invoice.id}
                title={invoice.invoice_number}
                subtitle={invoice.customers?.name}
                status={invoice.status}
                badge={getStatusBadge(invoice.status).props.children}
                badgeVariant={getStatusBadge(invoice.status).props.variant}
                metadata={[
                  { label: "Invoice Date", value: format(new Date(invoice.invoice_date), "dd MMM yyyy") },
                  { label: "Due Date", value: invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-" },
                  { label: "Amount", value: `$${invoice.total_amount.toFixed(2)}` },
                ]}
                to={`/invoices/${invoice.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total (ex GST)</TableHead>
                  <TableHead className="text-right">Total (inc GST)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acumatica Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((invoice) => (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium font-mono">
                      <Link to={`/invoices/${invoice.id}`} className="hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.customers?.name}</TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="font-medium text-right">
                      ${((invoice.total_amount || 0) - (invoice.tax_amount || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-medium text-right">${(invoice.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.acumatica_status ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {invoice.acumatica_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!isMobile && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} invoices
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
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
