import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface RelatedInvoicesCardProps {
  sourceType: "project" | "service_order";
  sourceId: string;
}

export default function RelatedInvoicesCard({ sourceType, sourceId }: RelatedInvoicesCardProps) {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["related-invoices", sourceType, sourceId],
    queryFn: async () => {
      // Get all invoice line items for this source
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .select("invoice_id, line_item_id")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId);

      if (lineItemsError) throw lineItemsError;
      if (!lineItems || lineItems.length === 0) return [];

      // Get unique invoice IDs
      const invoiceIds = Array.from(new Set(lineItems.map(li => li.invoice_id)));

      // Fetch invoice details
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .in("id", invoiceIds)
        .order("invoice_date", { ascending: false });

      if (invoicesError) throw invoicesError;

      // Add line item count to each invoice
      return invoicesData.map(invoice => ({
        ...invoice,
        lineItemCount: lineItems.filter(li => li.invoice_id === invoice.id).length,
      }));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Related Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading invoices...</div>
        </CardContent>
      </Card>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Related Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No invoices have been created for this {sourceType === "project" ? "project" : "service order"} yet.</div>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-info/10 text-info",
    approved: "bg-success/10 text-success",
    paid: "bg-success text-success-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Related Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{invoice.invoice_number}</span>
                  <Badge className={statusColors[invoice.status as keyof typeof statusColors]}>
                    {invoice.status}
                  </Badge>
                  {invoice.is_progress_invoice && (
                    <Badge variant="outline" className="text-xs">
                      Progress
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(invoice.invoice_date), "MMM dd, yyyy")} · {invoice.lineItemCount} line items · {formatCurrency(invoice.total_amount)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(`/invoices/${invoice.id}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
