import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/permissions";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { RecurringInvoiceDialog } from "@/components/invoices/RecurringInvoiceDialog";
import { format } from "date-fns";

export default function RecurringInvoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: recurringInvoices, isLoading } = useQuery({
    queryKey: ["recurring-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select(`
          *,
          customers (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredInvoices = recurringInvoices?.filter((invoice) => {
    const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
    return customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoice_number_prefix.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getFrequencyBadge = (frequency: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      daily: "default",
      weekly: "secondary",
      monthly: "outline",
      yearly: "outline",
    };
    return <Badge variant={variants[frequency] || "default"}>{frequency}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recurring Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Manage automated invoice generation schedules
            </p>
          </div>
          <PermissionButton 
            module="invoices" 
            permission="create"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Recurring Invoice
          </PermissionButton>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by customer or prefix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left font-medium">Prefix</th>
                  <th className="p-4 text-left font-medium">Customer</th>
                  <th className="p-4 text-left font-medium">Frequency</th>
                  <th className="p-4 text-left font-medium">Next Invoice</th>
                  <th className="p-4 text-right font-medium">Amount</th>
                  <th className="p-4 text-center font-medium">Status</th>
                  <th className="p-4 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading recurring invoices...
                    </td>
                  </tr>
                ) : filteredInvoices?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No recurring invoices found
                    </td>
                  </tr>
                ) : (
                  filteredInvoices?.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                    >
                      <td className="p-4 font-medium">
                        <Link to={`/recurring-invoices/${invoice.id}`} className="hover:underline">
                          {invoice.invoice_number_prefix}
                        </Link>
                      </td>
                      <td className="p-4">
                        {Array.isArray(invoice.customers) ? (invoice.customers[0] as any)?.name : (invoice.customers as any)?.name}
                      </td>
                      <td className="p-4">
                        {getFrequencyBadge(invoice.frequency)}
                        {invoice.interval_count > 1 && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            Every {invoice.interval_count}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(invoice.next_invoice_date), "MMM dd, yyyy")}
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="h-4 w-4" />
                          {invoice.total_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={invoice.is_active ? "default" : "secondary"}>
                          {invoice.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link to={`/recurring-invoices/${invoice.id}`} onClick={(e) => e.stopPropagation()}>
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RecurringInvoiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </DashboardLayout>
  );
}
