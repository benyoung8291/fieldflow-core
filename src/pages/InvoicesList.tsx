import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";

export default function InvoicesList() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          customers (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  const filteredInvoices = invoices?.filter((invoice) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(searchLower) ||
      invoice.customers?.name?.toLowerCase().includes(searchLower)
    );
  });

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
          <Button onClick={() => navigate("/invoices/create")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
        ) : filteredInvoices?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No invoices found</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredInvoices?.map((invoice) => (
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
                onClick={() => navigate(`/invoices/${invoice.id}`)}
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.customers?.name}</TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell className="font-medium">${invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}
