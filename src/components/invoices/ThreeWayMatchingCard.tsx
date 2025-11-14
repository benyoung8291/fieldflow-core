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

interface ThreeWayMatchingCardProps {
  invoiceId: string;
}

export default function ThreeWayMatchingCard({ invoiceId }: ThreeWayMatchingCardProps) {
  const [approvalNotes, setApprovalNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['ap-invoice-matching', invoiceId],
    queryFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          purchase_order:purchase_orders(*),
          supplier:suppliers(*),
          line_items:invoice_line_items(*),
          matching_data:ap_invoice_line_matching(*)
        `)
        .eq('id', invoiceId)
        .single();

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

  // Approve variance mutation
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

  if (!invoice || (invoice as any).invoice_type !== 'AP') {
    return null;
  }

  const getStatusBadge = () => {
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
          {invoice.matching_status === 'variance' && (
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
          {invoice.matching_status === 'matched' && (
            <Alert className="border-success bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription>
                Invoice matches purchase order within tolerance. Ready for payment.
              </AlertDescription>
            </Alert>
          )}

          {/* @ts-ignore - Types will update after migration */}
          {invoice.matching_status === 'approved' && (
            <Alert className="border-success bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription>
                Invoice approved for payment with variance notes.
                {/* @ts-ignore - Types will update after migration */}
                {invoice.variance_notes && (
                  // @ts-ignore - Types will update after migration
                  <p className="mt-2 text-sm italic">{invoice.variance_notes}</p>
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
