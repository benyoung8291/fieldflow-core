import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Package, 
  Receipt as ReceiptIcon,
  Clock,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface ThreeWayMatchingCardProps {
  invoiceId: string;
}

export default function ThreeWayMatchingCard({ invoiceId }: ThreeWayMatchingCardProps) {
  const [approvalNotes, setApprovalNotes] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const queryClient = useQueryClient();
  const { isAdmin, userRoles } = usePermissions();

  const isManager = isAdmin || userRoles.some(r => r.role === 'supervisor');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['ap-invoice-matching', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ap_invoices')
        .select(`
          *,
          supplier:suppliers(*),
          line_items:ap_invoice_line_items(*),
          matching_data:ap_invoice_line_matching(*)
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      if (!data) return null;

      // Fetch PO separately using RPC if it exists
      const invoiceData = data as any;
      if (invoiceData.purchase_order_id) {
        const { data: po } = await supabase
          .rpc('get_purchase_order_with_links', { p_po_id: invoiceData.purchase_order_id });
        
        if (po && po.length > 0) {
          return { ...data, purchase_order: po[0] };
        }
      }

      return data;

      if (error) throw error;
      return data;
    },
  });

  // Perform matching mutation
  const performMatchingMutation = useMutation({
    mutationFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase.rpc('perform_three_way_match', {
        p_invoice_id: invoiceId,
        p_tolerance_percentage: 5.0
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoice-matching', invoiceId] });
      
      // @ts-ignore - Types will update after migration
      if (result?.matching_status === 'matched') {
        toast.success('Invoice matched successfully - no variances detected');
      // @ts-ignore - Types will update after migration
      } else if (result?.matching_status === 'variance') {
        toast.warning('Variances detected - review required before approval');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to perform matching');
    },
  });

  // Request approval mutation
  const requestApprovalMutation = useMutation({
    mutationFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase.rpc('request_ap_invoice_approval', {
        p_invoice_id: invoiceId,
        p_notes: requestNotes
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoice-matching', invoiceId] });
      const message = data?.task_id 
        ? 'Approval requested and task assigned to document owner'
        : 'Approval request sent to managers';
      toast.success(message);
      setRequestNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to request approval');
    },
  });

  // Manager approve/reject mutation
  const managerDecisionMutation = useMutation({
    mutationFn: async ({ approve, notes }: { approve: boolean; notes: string }) => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase.rpc('approve_reject_ap_invoice_variance', {
        p_invoice_id: invoiceId,
        p_approve: approve,
        p_notes: notes
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoice-matching', invoiceId] });
      toast.success(data.message || 'Decision recorded');
      setApprovalNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process decision');
    },
  });

  // Legacy approve variance mutation (for backward compatibility)
  const approveVarianceMutation = useMutation({
    mutationFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase.rpc('approve_ap_invoice_variance', {
        p_invoice_id: invoiceId,
        p_notes: approvalNotes
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-invoice-matching', invoiceId] });
      toast.success('Invoice approved for payment');
      setApprovalNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve invoice');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!invoice) {
    return null;
  }

  const getStatusBadge = () => {
    // @ts-ignore - Types will update after migration
    if (invoice.approval_status === 'approved') {
      return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Manager Approved</Badge>;
    }
    // @ts-ignore - Types will update after migration
    if (invoice.approval_status === 'rejected') {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    }
    // @ts-ignore - Types will update after migration
    if (invoice.requires_manager_approval && invoice.approval_status === 'pending') {
      return <Badge variant="outline" className="border-warning text-warning"><Clock className="h-3 w-3 mr-1" /> Awaiting Approval</Badge>;
    }
    // @ts-ignore - Types will update after migration
    switch (invoice.matching_status) {
      case 'matched':
        return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Matched</Badge>;
      case 'variance':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Variance Detected</Badge>;
      case 'approved':
        return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  // @ts-ignore - Types will update after migration
  const totalVariance = invoice.matching_data?.reduce((sum: number, m: any) => 
    sum + (m.total_variance || 0), 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              3-Way PO Matching
            </CardTitle>
            <CardDescription>
              Match invoice against purchase order and receipts
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Matching Steps */}
        <div className="grid grid-cols-3 gap-4">
          <div className={cn(
            "p-4 border rounded-lg",
            // @ts-ignore - Types will update after migration
            invoice.purchase_order_id ? "border-success bg-success/5" : "border-muted"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <Package className={cn(
                "h-5 w-5",
                // @ts-ignore - Types will update after migration
                invoice.purchase_order_id ? "text-success" : "text-muted-foreground"
              )} />
              <h4 className="font-medium text-sm">Purchase Order</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {/* @ts-ignore - Types will update after migration */}
              {invoice.purchase_order_id ? (
                // @ts-ignore - Types will update after migration
                <>PO# {invoice.purchase_order?.po_number}</>
              ) : (
                'Not linked'
              )}
            </p>
          </div>

          <div className={cn(
            "p-4 border rounded-lg",
            // @ts-ignore - Types will update after migration
            invoice.receipt_matched_at ? "border-success bg-success/5" : "border-muted"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <ReceiptIcon className={cn(
                "h-5 w-5",
                // @ts-ignore - Types will update after migration
                invoice.receipt_matched_at ? "text-success" : "text-muted-foreground"
              )} />
              <h4 className="font-medium text-sm">Receipt</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {/* @ts-ignore - Types will update after migration */}
              {invoice.receipt_matched_at ? (
                'Verified'
              ) : (
                'Pending verification'
              )}
            </p>
          </div>

          <div className={cn(
            "p-4 border rounded-lg",
            // @ts-ignore - Types will update after migration
            invoice.po_matched_at ? "border-success bg-success/5" : "border-muted"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className={cn(
                "h-5 w-5",
                // @ts-ignore - Types will update after migration
                invoice.po_matched_at ? "text-success" : "text-muted-foreground"
              )} />
              <h4 className="font-medium text-sm">Invoice</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {/* @ts-ignore - Types will update after migration */}
              {invoice.po_matched_at ? (
                'Matched'
              ) : (
                'Pending'
              )}
            </p>
          </div>
        </div>

        {/* Variance Summary */}
        {/* @ts-ignore - Types will update after migration */}
        {invoice.matching_data && invoice.matching_data.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Line Item Variances</h4>
            <div className="space-y-2">
              {/* @ts-ignore - Types will update after migration */}
              {invoice.matching_data.map((match: any) => {
                // @ts-ignore - Types will update after migration
                const line = invoice.line_items?.find((l: any) => l.id === match.invoice_line_id);
                if (!line) return null;

                return (
                  <div key={match.id} className={cn(
                    "p-3 border rounded-lg",
                    match.is_matched ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
                  )}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{line.description}</p>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">PO Qty:</span>
                            <span className="ml-1 font-medium">{match.po_quantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Invoice Qty:</span>
                            <span className="ml-1 font-medium">{match.invoice_quantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Variance:</span>
                            <span className={cn(
                              "ml-1 font-medium",
                              match.quantity_variance !== 0 && "text-warning"
                            )}>
                              {match.quantity_variance > 0 && '+'}{match.quantity_variance}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">PO Price:</span>
                            <span className="ml-1 font-medium">${match.po_unit_price?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Invoice Price:</span>
                            <span className="ml-1 font-medium">${match.invoice_unit_price?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">$ Variance:</span>
                            <span className={cn(
                              "ml-1 font-medium",
                              match.total_variance !== 0 && "text-warning"
                            )}>
                              ${match.total_variance?.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {match.is_matched ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalVariance !== 0 && (
              <Alert className="border-warning bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  <strong>Total Variance: ${Math.abs(totalVariance).toFixed(2)}</strong>
                  {totalVariance > 0 ? ' (Over)' : ' (Under)'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          {/* @ts-ignore - Types will update after migration */}
          {invoice.matching_status === 'pending' && (
            <Button
              onClick={() => performMatchingMutation.mutate()}
              disabled={performMatchingMutation.isPending}
            >
              {performMatchingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Perform Matching
            </Button>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {invoice.matching_status === 'variance' && !invoice.requires_manager_approval && (
            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="approval-notes">Approval Notes</Label>
                <Textarea
                  id="approval-notes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Explain why this variance is acceptable..."
                  rows={2}
                />
              </div>
              <Button
                onClick={() => approveVarianceMutation.mutate()}
                disabled={approveVarianceMutation.isPending || !approvalNotes}
                variant="default"
              >
                {approveVarianceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve for Payment
              </Button>
            </div>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {invoice.matching_status === 'variance' && invoice.requires_manager_approval && invoice.approval_status === 'pending' && !isManager && (
            <div className="flex-1 space-y-3">
              <Alert className="border-warning bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  Variance exceeds threshold and requires manager approval before payment.
                </AlertDescription>
              </Alert>
              
              {/* @ts-ignore - Types will update after migration */}
              {!invoice.approval_requested_at ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="request-notes">Request Notes</Label>
                    <Textarea
                      id="request-notes"
                      value={requestNotes}
                      onChange={(e) => setRequestNotes(e.target.value)}
                      placeholder="Explain why this variance should be approved..."
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => requestApprovalMutation.mutate()}
                    disabled={requestApprovalMutation.isPending || !requestNotes}
                    variant="default"
                  >
                    {requestApprovalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Manager Approval
                  </Button>
                </>
              ) : (
                <Alert className="border-blue-500 bg-blue-500/5">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <AlertDescription>
                    Approval request sent to managers. Waiting for decision.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {invoice.requires_manager_approval && invoice.approval_status === 'pending' && isManager && (
            <div className="flex-1 space-y-3">
              <Alert className="border-warning bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  <strong>Manager Approval Required</strong>
                  <p className="mt-1">Variance exceeds threshold. Please review and approve or reject.</p>
                  {/* @ts-ignore - Types will update after migration */}
                  {invoice.manager_approval_notes && (
                    // @ts-ignore - Types will update after migration
                    <p className="mt-2 text-sm italic">Request notes: {invoice.manager_approval_notes}</p>
                  )}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="manager-notes">Decision Notes</Label>
                <Textarea
                  id="manager-notes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Explain your decision..."
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => managerDecisionMutation.mutate({ approve: true, notes: approvalNotes })}
                  disabled={managerDecisionMutation.isPending || !approvalNotes}
                  variant="default"
                >
                  {managerDecisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve for Payment
                </Button>
                <Button
                  onClick={() => managerDecisionMutation.mutate({ approve: false, notes: approvalNotes })}
                  disabled={managerDecisionMutation.isPending || !approvalNotes}
                  variant="destructive"
                >
                  {managerDecisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reject
                </Button>
              </div>
            </div>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {invoice.matching_status === 'matched' && (
            <Alert className="border-success bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription>
                Invoice matches purchase order within tolerance. Ready for payment.
              </AlertDescription>
            </Alert>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {(invoice.matching_status === 'approved' || invoice.approval_status === 'approved') && (
            <Alert className="border-success bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription>
                Invoice approved for payment.
                {/* @ts-ignore - Types will update after migration */}
                {invoice.manager_approval_notes && (
                  // @ts-ignore - Types will update after migration
                  <p className="mt-2 text-sm italic">Approval notes: {invoice.manager_approval_notes}</p>
                )}
                {/* @ts-ignore - Types will update after migration */}
                {invoice.variance_notes && (
                  // @ts-ignore - Types will update after migration
                  <p className="mt-2 text-sm italic">{invoice.variance_notes}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {invoice.approval_status === 'rejected' && (
            <Alert className="border-destructive bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription>
                Invoice rejected by manager.
                {/* @ts-ignore - Types will update after migration */}
                {invoice.manager_approval_notes && (
                  // @ts-ignore - Types will update after migration
                  <p className="mt-2 text-sm italic">Rejection reason: {invoice.manager_approval_notes}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Matching Info */}
        {/* @ts-ignore - Types will update after migration */}
        {invoice.po_matched_at && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            {/* @ts-ignore - Types will update after migration */}
            Last matched: {new Date(invoice.po_matched_at).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
