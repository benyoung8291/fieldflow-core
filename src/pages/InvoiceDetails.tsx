import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (
            id,
            name,
            email,
            billing_address
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ["invoice-line-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("item_order");

      if (error) throw error;

      // Fetch source document details for each line item
      const sourceDocuments = new Map();
      
      for (const item of data || []) {
        if (!item.source_id || !item.source_type) continue;
        
        const key = `${item.source_type}-${item.source_id}`;
        if (sourceDocuments.has(key)) continue;

        if (item.source_type === "project") {
          const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id, name, start_date, end_date")
            .eq("id", item.source_id)
            .single();
          
          if (!projectError && project) {
            sourceDocuments.set(key, { 
              type: "project" as const, 
              id: project.id,
              name: project.name,
              start_date: project.start_date,
              end_date: project.end_date
            });
          }
        } else if (item.source_type === "service_order") {
          const { data: order, error: orderError } = await supabase
            .from("service_orders")
            .select("id, order_number, title, work_order_number, purchase_order_number")
            .eq("id", item.source_id)
            .single();
          
          if (!orderError && order) {
            sourceDocuments.set(key, { 
              type: "service_order" as const,
              id: order.id,
              order_number: order.order_number,
              title: order.title,
              work_order_number: order.work_order_number,
              purchase_order_number: order.purchase_order_number
            });
          }
        }
      }

      return { lineItems: data, sourceDocuments };
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      // If status is approved, trigger integration sync
      if (status === "approved") {
        // Call edge function to sync with accounting systems
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-invoice-to-accounting`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ invoice_id: id }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Invoice status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update invoice status");
    },
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-muted-foreground">Loading invoice...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-muted-foreground">Invoice not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/invoices")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Invoice {invoice.invoice_number}
              </h1>
              <p className="text-muted-foreground">View and manage invoice details</p>
            </div>
            <div className="flex items-center gap-2">
              {invoice.status === "draft" && (
                <Button onClick={() => updateStatusMutation.mutate("sent")}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Customer
                </Button>
              )}
              {invoice.status === "sent" && (
                <Button onClick={() => updateStatusMutation.mutate("approved")}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Approved
                </Button>
              )}
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoice Details</CardTitle>
                <div className="flex items-center gap-2">
                  {invoice.is_progress_invoice && (
                    <Badge variant="outline" className="text-xs">
                      Progress
                    </Badge>
                  )}
                  {getStatusBadge(invoice.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Invoice Date</div>
                  <div className="font-medium">{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Due Date</div>
                  <div className="font-medium">
                    {invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "-"}
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm">{invoice.notes}</div>
                </div>
              )}

              <Separator />

              <div>
                <div className="text-sm font-medium mb-4">Line Items</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>Project Date</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems?.lineItems?.reduce((acc: JSX.Element[], item: any) => {
                      const sourceKey = `${item.source_type}-${item.source_id}`;
                      const sourceDoc = lineItems.sourceDocuments?.get(sourceKey);

                      // Add header row if this is the first item from this source
                      const isFirstFromSource = !acc.some(
                        (row: any) => row.key?.startsWith(`${sourceKey}-header`)
                      );

                      if (isFirstFromSource && sourceDoc) {
                        acc.push(
                          <TableRow key={`${sourceKey}-header`} className="bg-muted/30">
                            <TableCell colSpan={7} className="font-medium text-sm">
                              {sourceDoc.type === "project" ? (
                                <>Project: {sourceDoc.name}</>
                              ) : (
                                <>{sourceDoc.order_number} - {sourceDoc.title}</>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      // Add the line item row
                      acc.push(
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sourceDoc?.type === "service_order" && sourceDoc.work_order_number
                              ? sourceDoc.work_order_number
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sourceDoc?.type === "service_order" && sourceDoc.purchase_order_number
                              ? sourceDoc.purchase_order_number
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sourceDoc?.type === "project" && sourceDoc.start_date
                              ? format(new Date(sourceDoc.start_date), "dd MMM yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.line_total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );

                      return acc;
                    }, [])}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({(invoice.tax_rate * 100).toFixed(0)}%)</span>
                  <span className="font-medium">${invoice.tax_amount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total Amount</span>
                  <span className="font-bold text-lg text-primary">${invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Customer Name</div>
                  <div className="font-medium">{invoice.customers?.name}</div>
                </div>
                {invoice.customers?.email && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Email</div>
                    <div className="text-sm">{invoice.customers.email}</div>
                  </div>
                )}
                {invoice.customers?.billing_address && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Billing Address</div>
                    <div className="text-sm">{invoice.customers.billing_address}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
