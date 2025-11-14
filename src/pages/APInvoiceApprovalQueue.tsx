import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle, FileText, Building } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface PendingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  supplier_id: string;
  suppliers?: {
    name: string;
  };
  purchase_order_id: string;
  purchase_orders?: {
    po_number: string;
  };
  approval_requested_at: string;
  approval_requested_by: string;
  manager_approval_notes: string | null;
  variance_percentage?: number;
  total_variance?: number;
}

export default function APInvoiceApprovalQueue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");

  const { data: pendingInvoices = [], isLoading } = useQuery({
    queryKey: ['ap-invoice-approval-queue'],
    queryFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          suppliers (name),
          purchase_orders (po_number)
        `)
        .eq('invoice_type', 'AP')
        .eq('requires_manager_approval', true)
        .eq('approval_status', 'pending')
        .order('approval_requested_at', { ascending: false });

      if (error) throw error;

      // Calculate variance for each invoice
      const invoicesWithVariance = await Promise.all(
        (data || []).map(async (invoice: any) => {
          // @ts-ignore - Types will update after migration
          const { data: matchingData } = await supabase
            // @ts-ignore - Types will update after migration
            .from('ap_invoice_line_matching')
            .select('total_variance')
            .eq('invoice_id', invoice.id);

          const totalVariance = matchingData?.reduce((sum: number, m: any) => 
            sum + (m.total_variance || 0), 0) || 0;

          const variancePercentage = invoice.total_amount > 0 
            ? Math.abs(totalVariance / invoice.total_amount * 100)
            : 0;

          return {
            ...invoice,
            total_variance: totalVariance,
            variance_percentage: variancePercentage,
          };
        })
      );

      // @ts-ignore - Types will update after migration
      return invoicesWithVariance as PendingInvoice[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const processBulkMutation = useMutation({
    mutationFn: async ({ invoiceIds, approve, notes }: { invoiceIds: string[], approve: boolean, notes: string }) => {
      const results = await Promise.all(
        invoiceIds.map(async (invoiceId) => {
          try {
            // @ts-ignore - Types will update after migration
            const { data, error } = await supabase.rpc('approve_reject_ap_invoice_variance', {
              p_invoice_id: invoiceId,
              p_approve: approve,
              p_notes: notes
            });

            if (error) throw error;
            return { invoiceId, success: true };
          } catch (error) {
            return { invoiceId, success: false, error };
          }
        })
      );

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      queryClient.invalidateQueries({ queryKey: ['ap-invoice-approval-queue'] });
      
      if (failCount === 0) {
        toast.success(`${successCount} invoice${successCount > 1 ? 's' : ''} processed successfully`);
      } else {
        toast.warning(`${successCount} succeeded, ${failCount} failed`);
      }

      setSelectedInvoices(new Set());
      setBulkAction(null);
      setBulkNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process invoices');
    },
  });

  const toggleInvoiceSelection = (invoiceId: string) => {
    const newSelection = new Set(selectedInvoices);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoices(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === pendingInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(pendingInvoices.map(inv => inv.id)));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    if (selectedInvoices.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }
    setBulkAction(action);
  };

  const confirmBulkAction = () => {
    if (!bulkNotes.trim()) {
      toast.error('Please provide notes for this decision');
      return;
    }

    processBulkMutation.mutate({
      invoiceIds: Array.from(selectedInvoices),
      approve: bulkAction === 'approve',
      notes: bulkNotes,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AP Invoice Approval Queue</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve invoices with variances above threshold
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Clock className="h-4 w-4 mr-2" />
            {pendingInvoices.length} Pending
          </Badge>
        </div>

        {/* Bulk Actions Bar */}
        {selectedInvoices.size > 0 && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {selectedInvoices.size} invoice{selectedInvoices.size > 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedInvoices(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleBulkAction('approve')}
                    disabled={processBulkMutation.isPending}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Bulk Approve
                  </Button>
                  <Button
                    onClick={() => handleBulkAction('reject')}
                    disabled={processBulkMutation.isPending}
                    variant="destructive"
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Bulk Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              Invoices requiring manager approval due to variances exceeding threshold
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingInvoices.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-muted-foreground mt-1">
                  No invoices pending approval at the moment
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedInvoices.size === pendingInvoices.length && pendingInvoices.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>PO</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedInvoices.has(invoice.id)}
                          onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{invoice.invoice_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {invoice.suppliers?.name || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {invoice.purchase_orders?.po_number || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${invoice.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <Badge variant="destructive" className="mb-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {invoice.variance_percentage?.toFixed(1)}%
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ${Math.abs(invoice.total_variance || 0).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(invoice.approval_requested_at), "dd MMM HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">
                          {invoice.manager_approval_notes || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkAction !== null} onOpenChange={() => setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'approve' ? 'Bulk Approve Invoices' : 'Bulk Reject Invoices'}
            </DialogTitle>
            <DialogDescription>
              You are about to {bulkAction === 'approve' ? 'approve' : 'reject'}{' '}
              {selectedInvoices.size} invoice{selectedInvoices.size > 1 ? 's' : ''}.
              Please provide notes explaining your decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-notes">Decision Notes *</Label>
              <Textarea
                id="bulk-notes"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder={`Explain why you're ${bulkAction === 'approve' ? 'approving' : 'rejecting'} these invoices...`}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setBulkAction(null);
                setBulkNotes("");
              }}
              disabled={processBulkMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBulkAction}
              disabled={processBulkMutation.isPending || !bulkNotes.trim()}
              variant={bulkAction === 'approve' ? 'default' : 'destructive'}
            >
              {processBulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkAction === 'approve' ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Approval
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
