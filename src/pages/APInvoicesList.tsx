import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { useAPInvoices } from "@/hooks/useAPInvoices";
import APInvoiceDialog from "@/components/invoices/APInvoiceDialog";

export default function APInvoicesList() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: apInvoices, isLoading, refetch } = useAPInvoices(statusFilter);

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  const filteredInvoices = apInvoices?.filter((invoice) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(searchLower) ||
      invoice.supplier_invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.suppliers?.name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      approved: "default",
      paid: "default",
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
              <h1 className="text-3xl font-bold text-foreground mb-2">AP Invoices</h1>
              <p className="text-muted-foreground">Manage and track supplier bills (accounts payable)</p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create AP Invoice
            </Button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number, supplier invoice #, or supplier name..."
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
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading AP invoices...</p>
            </div>
          ) : filteredInvoices?.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No AP invoices found</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredInvoices?.map((invoice) => (
                <MobileDocumentCard
                  key={invoice.id}
                  title={invoice.invoice_number}
                  subtitle={invoice.suppliers?.name}
                  status={invoice.status}
                  badge={getStatusBadge(invoice.status).props.children}
                  badgeVariant={getStatusBadge(invoice.status).props.variant}
                  metadata={[
                    { label: "Invoice Date", value: format(new Date(invoice.invoice_date), "dd MMM yyyy") },
                    { label: "Due Date", value: invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-" },
                    { label: "Amount", value: `$${invoice.total_amount.toFixed(2)}` },
                    { label: "Supplier Invoice #", value: invoice.supplier_invoice_number || "-" },
                  ]}
                  onClick={() => navigate(`/ap-invoices/${invoice.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Supplier Invoice #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acumatica Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices?.map((invoice) => (
                    <TableRow 
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/ap-invoices/${invoice.id}`)}
                    >
                      <TableCell className="font-medium font-mono">{invoice.invoice_number}</TableCell>
                      <TableCell className="font-mono text-sm">{invoice.supplier_invoice_number || "-"}</TableCell>
                      <TableCell>{invoice.suppliers?.name}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-right">
                        ${(invoice.subtotal || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-medium text-right">
                        ${(invoice.tax_amount || 0).toFixed(2)}
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
        </div>
      </div>

      <APInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          refetch();
        }}
      />
    </DashboardLayout>
  );
}
