import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
        service_order: "*, customer:customers(name)",
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>{getDocumentTitle()}</DialogTitle>
          <Button
            variant="ghost"
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
            {document.customer && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Customer</div>
                <div className="text-base">{document.customer.name}</div>
              </div>
            )}
            
            {document.description && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Description</div>
                <div className="text-base whitespace-pre-wrap">{document.description}</div>
              </div>
            )}

            {document.status && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <div className="text-base capitalize">{document.status}</div>
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
                <div className="text-base">${document.total.toFixed(2)}</div>
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
