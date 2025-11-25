import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

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

  // Fetch related data for service orders
  const { data: relatedData, isLoading: isLoadingRelated } = useQuery({
    queryKey: ["document-related", documentType, documentId],
    queryFn: async () => {
      if (documentType !== "service_order") return null;

      const [notesRes, appointmentsRes, invoicesRes, expensesRes] = await Promise.all([
        supabase
          .from("document_notes")
          .select("*, created_by:profiles!document_notes_created_by_fkey(first_name, last_name)")
          .eq("document_type", "service_order")
          .eq("document_id", documentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("*, assigned_to:profiles(first_name, last_name)")
          .eq("service_order_id", documentId)
          .order("start_time", { ascending: false }),
        supabase
          .from("ap_invoices")
          .select("*, supplier:suppliers(name)")
          .eq("service_order_id", documentId)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("expenses")
          .select("*, submitted_by:profiles!expenses_submitted_by_fkey(first_name, last_name), category:expense_categories(name)")
          .eq("service_order_id", documentId)
          .order("expense_date", { ascending: false }),
      ]);

      return {
        notes: notesRes.data || [],
        appointments: appointmentsRes.data || [],
        invoices: invoicesRes.data || [],
        expenses: expensesRes.data || [],
      };
    },
    enabled: open && documentType === "service_order" && !!documentId,
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
          documentType === "service_order" ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
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

                  {document.preferred_date && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Preferred Date</div>
                      <div className="text-base">
                        {format(new Date(document.preferred_date), "PPP")}
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

                {document.description && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Description</div>
                    <div className="text-base whitespace-pre-wrap mt-1">{document.description}</div>
                  </div>
                )}

                {document.key_number && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Key Number</div>
                    <div className="text-base">{document.key_number}</div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="appointments" className="mt-4">
                {isLoadingRelated ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : relatedData?.appointments && relatedData.appointments.length > 0 ? (
                  <div className="space-y-3">
                    {relatedData.appointments.map((apt: any) => (
                      <div key={apt.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{apt.title}</div>
                          <div className="text-sm px-2 py-1 rounded-full bg-muted capitalize">
                            {apt.status}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(apt.start_time), "PPP p")} - {format(new Date(apt.end_time), "p")}
                        </div>
                        {apt.assigned_to && (
                          <div className="text-sm">
                            Assigned to: {apt.assigned_to.first_name} {apt.assigned_to.last_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No appointments found</div>
                )}
              </TabsContent>

              <TabsContent value="invoices" className="mt-4">
                {isLoadingRelated ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : relatedData?.invoices && relatedData.invoices.length > 0 ? (
                  <div className="space-y-3">
                    {relatedData.invoices.map((invoice: any) => (
                      <div key={invoice.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{invoice.invoice_number}</div>
                          <div className="font-semibold">{formatCurrency(invoice.total_amount)}</div>
                        </div>
                        {invoice.supplier && (
                          <div className="text-sm text-muted-foreground">
                            Supplier: {invoice.supplier.name}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Date: {format(new Date(invoice.invoice_date), "PPP")}
                        </div>
                        <div className="text-sm px-2 py-1 rounded-full bg-muted capitalize inline-block">
                          {invoice.status}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No invoices found</div>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="mt-4">
                {isLoadingRelated ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : relatedData?.expenses && relatedData.expenses.length > 0 ? (
                  <div className="space-y-3">
                    {relatedData.expenses.map((expense: any) => (
                      <div key={expense.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{expense.description}</div>
                          <div className="font-semibold">{formatCurrency(expense.amount)}</div>
                        </div>
                        {expense.category && (
                          <div className="text-sm text-muted-foreground">
                            Category: {expense.category.name}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Date: {format(new Date(expense.expense_date), "PPP")}
                        </div>
                        {expense.submitted_by && (
                          <div className="text-sm text-muted-foreground">
                            Submitted by: {expense.submitted_by.first_name} {expense.submitted_by.last_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No expenses found</div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                {isLoadingRelated ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : relatedData?.notes && relatedData.notes.length > 0 ? (
                  <div className="space-y-3">
                    {relatedData.notes.map((note: any) => (
                      <div key={note.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {note.created_by?.first_name} {note.created_by?.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), "PPP p")}
                          </div>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{note.content}</div>
                        {note.is_sticky && (
                          <div className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100 inline-block">
                            Pinned
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No notes found</div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
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
                    {format(new Date(document.created_at), "PPP")}
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
          )
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Document not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
