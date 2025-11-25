import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";

interface LinkedDocumentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  documentId: string;
}

export function LinkedDocumentDetailsDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
}: LinkedDocumentDetailsDialogProps) {
  const navigate = useNavigate();

  const { data: document, isLoading } = useQuery({
    queryKey: ["document-details", documentType, documentId],
    queryFn: async () => {
      const tableMap: Record<string, string> = {
        service_order: "service_orders",
        quote: "quotes",
        invoice: "invoices",
        project: "projects",
        task: "tasks",
        appointment: "appointments",
      };

      const selectMap: Record<string, string> = {
        service_order: "*, customer:customers(name), location:customer_locations!location_id(name, formatted_address)",
        quote: "*, customer:customers(name)",
        invoice: "*, customer:customers(name)",
        project: "*, customer:customers(name)",
        task: "*",
        appointment: "*, customer:customers(name)",
      };

      const tableName = tableMap[documentType];
      const selectQuery = selectMap[documentType];

      const { data, error } = await supabase
        .from(tableName as any)
        .select(selectQuery)
        .eq("id", documentId)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: open && !!documentType && !!documentId,
  });

  const handleOpenInNewTab = () => {
    const routeMap: Record<string, string> = {
      service_order: `/service-orders/${documentId}`,
      quote: `/quotes/${documentId}`,
      invoice: `/invoices/${documentId}`,
      project: `/projects/${documentId}`,
      task: `/tasks`,
      appointment: `/appointments/${documentId}`,
    };

    const route = routeMap[documentType];
    if (route) {
      window.open(route, "_blank");
    }
  };

  const getDocumentTitle = () => {
    if (!document) return "Loading...";
    
    if (documentType === "service_order") return document.work_order_number || "Service Order";
    if (documentType === "quote") return document.quote_number || "Quote";
    if (documentType === "invoice") return document.invoice_number || "Invoice";
    if (documentType === "project") return document.name || "Project";
    if (documentType === "task") return document.title || "Task";
    if (documentType === "appointment") return document.title || "Appointment";
    return "Document";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-xl">{getDocumentTitle()}</DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInNewTab}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open in New Tab
          </Button>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : document ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {document.customer && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Customer</div>
                  <div className="text-base">{document.customer.name}</div>
                </div>
              )}

              {document.status && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <div className="text-base capitalize">{document.status.replace('_', ' ')}</div>
                </div>
              )}
            </div>

            {documentType === "service_order" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {document.preferred_date && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Preferred Date</div>
                      <div className="text-base">
                        {new Date(document.preferred_date).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {document.billing_type && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Billing Type</div>
                      <div className="text-base capitalize">{document.billing_type}</div>
                    </div>
                  )}
                </div>

                {document.location && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Location</div>
                    <div className="text-base">
                      {document.location.name}
                      {document.location.formatted_address && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {document.location.formatted_address}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {document.estimated_hours && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Estimated Hours</div>
                      <div className="text-base">{document.estimated_hours}h</div>
                    </div>
                  )}

                  {document.total_amount && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
                      <div className="text-base font-semibold">{formatCurrency(document.total_amount)}</div>
                    </div>
                  )}
                </div>

                {document.key_number && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Key Number</div>
                    <div className="text-base">{document.key_number}</div>
                  </div>
                )}
              </>
            )}
            
            {document.description && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Description</div>
                <div className="text-base whitespace-pre-wrap">{document.description}</div>
              </div>
            )}

            {document.created_at && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Created</div>
                <div className="text-base">
                  {new Date(document.created_at).toLocaleDateString()}
                </div>
              </div>
            )}

            {(documentType === "quote" || documentType === "invoice") && document.total && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total</div>
                <div className="text-base font-semibold">{formatCurrency(document.total)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Document not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
