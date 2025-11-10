import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, DollarSign, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { RecurringInvoiceDialog } from "@/components/invoices/RecurringInvoiceDialog";

export default function RecurringInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: recurringInvoice } = useQuery({
    queryKey: ["recurring-invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select(`
          *,
          customers (
            id,
            name,
            email
          ),
          recurring_invoice_line_items (
            *
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: generatedInvoices } = useQuery({
    queryKey: ["generated-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("recurring_invoice_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (!recurringInvoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/recurring-invoices")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {recurringInvoice.invoice_number_prefix}
              </h1>
              <p className="text-muted-foreground mt-1">
                Recurring Invoice Details
              </p>
            </div>
          </div>
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Details</CardTitle>
              <CardDescription>Invoice generation schedule</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={recurringInvoice.is_active ? "default" : "secondary"}>
                  {recurringInvoice.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Frequency</span>
                <span className="font-medium">
                  {recurringInvoice.interval_count > 1 && `Every ${recurringInvoice.interval_count} `}
                  {recurringInvoice.frequency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(recurringInvoice.start_date), "MMM dd, yyyy")}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next Invoice</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(recurringInvoice.next_invoice_date), "MMM dd, yyyy")}
                </div>
              </div>
              {recurringInvoice.end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">End Date</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(recurringInvoice.end_date), "MMM dd, yyyy")}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer & Amount</CardTitle>
              <CardDescription>Invoice recipient and total</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customer</span>
                <span className="font-medium">
                  {Array.isArray(recurringInvoice.customers) 
                    ? (recurringInvoice.customers[0] as any)?.name 
                    : (recurringInvoice.customers as any)?.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">
                  {Array.isArray(recurringInvoice.customers) 
                    ? (recurringInvoice.customers[0] as any)?.email || "N/A"
                    : (recurringInvoice.customers as any)?.email || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <div className="flex items-center gap-1 font-medium">
                  <DollarSign className="h-4 w-4" />
                  {recurringInvoice.subtotal.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tax ({recurringInvoice.tax_rate}%)</span>
                <div className="flex items-center gap-1 font-medium">
                  <DollarSign className="h-4 w-4" />
                  {recurringInvoice.tax_amount.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="font-medium">Total</span>
                <div className="flex items-center gap-1 text-lg font-bold">
                  <DollarSign className="h-5 w-5" />
                  {recurringInvoice.total_amount.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>Items included in each invoice</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left text-sm font-medium">Description</th>
                  <th className="p-2 text-right text-sm font-medium">Quantity</th>
                  <th className="p-2 text-right text-sm font-medium">Unit Price</th>
                  <th className="p-2 text-right text-sm font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {recurringInvoice.recurring_invoice_line_items?.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">${item.unit_price.toLocaleString()}</td>
                    <td className="p-2 text-right font-medium">${item.line_total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
            <CardDescription>
              {generatedInvoices?.length || 0} invoices generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedInvoices?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No invoices generated yet
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">Invoice Number</th>
                    <th className="p-2 text-left text-sm font-medium">Date</th>
                    <th className="p-2 text-left text-sm font-medium">Due Date</th>
                    <th className="p-2 text-right text-sm font-medium">Amount</th>
                    <th className="p-2 text-center text-sm font-medium">Status</th>
                    <th className="p-2 text-center text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedInvoices?.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{invoice.invoice_number}</td>
                      <td className="p-2">{format(new Date(invoice.invoice_date), "MMM dd, yyyy")}</td>
                      <td className="p-2">{format(new Date(invoice.due_date), "MMM dd, yyyy")}</td>
                      <td className="p-2 text-right">${invoice.total_amount.toLocaleString()}</td>
                      <td className="p-2 text-center">
                        <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <RecurringInvoiceDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        recurringInvoiceId={id}
      />
    </DashboardLayout>
  );
}
