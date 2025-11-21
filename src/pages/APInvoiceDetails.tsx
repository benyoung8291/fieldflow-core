import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  User, 
  Calendar,
  DollarSign,
  Building2,
  Send,
  CheckCircle2,
  ArrowLeft,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import DocumentDetailLayout from "@/components/layout/DocumentDetailLayout";
import { useAPInvoice, useUpdateAPInvoice, useDeleteAPInvoice, useSyncAPInvoiceToAcumatica } from "@/hooks/useAPInvoices";
import { useAPInvoiceLineItems } from "@/hooks/useAPInvoiceLineItems";
import AuditTimeline from "@/components/audit/AuditTimeline";

export default function APInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: invoice, isLoading } = useAPInvoice(id);
  const { data: lineItems } = useAPInvoiceLineItems(id);
  const updateMutation = useUpdateAPInvoice(id!);
  const deleteMutation = useDeleteAPInvoice();
  const syncMutation = useSyncAPInvoiceToAcumatica(id!);

  const handleApprove = () => {
    if (invoice?.acumatica_status === "Released") {
      toast.error("Cannot change status - invoice is Released in MYOB Acumatica");
      return;
    }

    updateMutation.mutate({ status: "approved" }, {
      onSuccess: () => {
        // Automatically sync to Acumatica after approval
        syncMutation.mutate();
      }
    });
  };

  const handleDelete = () => {
    if (invoice?.acumatica_reference_nbr) {
      toast.error("Cannot delete - invoice is synced to Acumatica");
      return;
    }

    deleteMutation.mutate(id!, {
      onSuccess: () => {
        navigate("/ap-invoices");
      }
    });
  };

  if (isLoading || !invoice) {
    return (
      <DocumentDetailLayout
        title="Loading..."
        backPath="/ap-invoices"
        tabs={[]}
        isLoading={isLoading}
        notFoundMessage={!isLoading && !invoice ? "AP Invoice not found" : undefined}
      />
    );
  }

  const canEdit = invoice.status === "draft" && !invoice.acumatica_reference_nbr;
  const canApprove = invoice.status === "draft" && !invoice.acumatica_reference_nbr;
  const isSynced = !!invoice.acumatica_reference_nbr;

  const statusBadges: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline"; className?: string }> = [
    {
      label: invoice.status,
      variant: invoice.status === "approved" ? "default" : "outline"
    },
    ...(isSynced ? [{
      label: "Synced to Acumatica",
      variant: "outline" as const,
      className: "bg-green-500/10 text-green-700 dark:text-green-400"
    }] : []),
    ...(invoice.acumatica_status ? [{
      label: invoice.acumatica_status,
      variant: "outline" as const,
      className: "font-mono"
    }] : []),
  ];

  const primaryActions: Array<{ label: string; icon?: any; onClick: () => void; variant?: "default" | "outline" | "destructive" | "ghost" }> = [
    ...(canApprove ? [{
      label: syncMutation.isPending ? "Approving & Syncing..." : "Approve & Sync",
      onClick: handleApprove,
      variant: "default" as const
    }] : []),
    ...(canEdit ? [{
      label: "Delete",
      onClick: () => setDeleteDialogOpen(true),
      variant: "destructive" as const
    }] : []),
  ];

  const keyInfoSection = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div>
        <div className="text-sm text-muted-foreground mb-1">Supplier Invoice #</div>
        <div className="font-medium font-mono">{invoice.supplier_invoice_number || "-"}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
        <div className="font-medium text-lg">${invoice.total_amount.toFixed(2)}</div>
      </div>
    </div>
  );

  const tabs = [
    {
      value: "line-items",
      label: "Line Items",
      icon: <FileText className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Sub Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${item.line_total.toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-sm">{item.account_code || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{item.sub_account || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!lineItems || lineItems.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No line items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="mt-6 border-t pt-4">
              <div className="flex justify-end space-y-2">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (10%):</span>
                    <span className="font-medium">${invoice.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>${invoice.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      value: "supplier",
      label: "Supplier",
      icon: <User className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Supplier Name</div>
              <div className="font-medium">{invoice.suppliers?.name}</div>
            </div>
            {invoice.suppliers?.email && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Email</div>
                <div className="font-medium">{invoice.suppliers.email}</div>
              </div>
            )}
            {invoice.suppliers?.phone && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Phone</div>
                <div className="font-medium">{invoice.suppliers.phone}</div>
              </div>
            )}
            {invoice.suppliers?.address && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Address</div>
                <div className="font-medium">{invoice.suppliers.address}</div>
              </div>
            )}
            {invoice.suppliers?.abn && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">ABN</div>
                <div className="font-medium font-mono">{invoice.suppliers.abn}</div>
              </div>
            )}
            {invoice.suppliers?.acumatica_supplier_id && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Acumatica Supplier ID</div>
                <div className="font-medium font-mono">{invoice.suppliers.acumatica_supplier_id}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "history",
      label: "History",
      icon: <Calendar className="h-4 w-4" />,
      content: <AuditTimeline tableName="ap_invoices" recordId={id!} />,
    },
  ];

  return (
    <>
      <DocumentDetailLayout
        title={`AP Invoice ${invoice.invoice_number}`}
        subtitle="Supplier bill details"
        backPath="/ap-invoices"
        statusBadges={statusBadges}
        primaryActions={primaryActions}
        keyInfoSection={keyInfoSection}
        tabs={tabs}
        auditTableName="ap_invoices"
        auditRecordId={id!}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AP Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete AP invoice {invoice.invoice_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
