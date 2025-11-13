import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  is_gst_free: boolean;
  subtotal: number;
  tax_amount: number;
  total: number;
}

interface ComparisonData {
  quoteLines: LineItem[];
  invoiceLines: LineItem[];
  accountingLines: LineItem[];
}

interface LineItemComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentType: 'quote' | 'invoice';
  quoteId: string | null;
}

export default function LineItemComparisonDialog({
  open,
  onOpenChange,
  documentId,
  documentType,
  quoteId,
}: LineItemComparisonDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ComparisonData>({
    quoteLines: [],
    invoiceLines: [],
    accountingLines: [],
  });

  useEffect(() => {
    if (open) {
      loadLineItems();
    }
  }, [open, documentId]);

  const loadLineItems = async () => {
    setLoading(true);
    try {
      const comparisonData: ComparisonData = {
        quoteLines: [],
        invoiceLines: [],
        accountingLines: [],
      };

      // Load quote line items
      if (quoteId || documentType === 'quote') {
        const targetQuoteId = quoteId || documentId;
        const { data: quoteLines, error: quoteError } = await supabase
          .from('quote_line_items')
          .select('description, quantity, unit_price, line_total, is_gst_free')
          .eq('quote_id', targetQuoteId)
          .order('created_at', { ascending: true });

        if (quoteError) throw quoteError;

        comparisonData.quoteLines = (quoteLines || []).map(line => {
          const subtotal = line.line_total || 0;
          const taxAmount = line.is_gst_free ? 0 : subtotal * 0.1;
          return {
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            is_gst_free: line.is_gst_free,
            subtotal,
            tax_amount: taxAmount,
            total: subtotal + taxAmount,
          };
        });
      }

      // Load invoice line items
      if (documentType === 'invoice') {
        const { data: invoiceLines, error: invoiceError } = await supabase
          .from('invoice_line_items')
          .select('description, quantity, unit_price, line_total, is_gst_free')
          .eq('invoice_id', documentId)
          .order('created_at', { ascending: true });

        if (invoiceError) throw invoiceError;

        comparisonData.invoiceLines = (invoiceLines || []).map(line => {
          const subtotal = line.line_total || 0;
          const taxAmount = line.is_gst_free ? 0 : subtotal * 0.1;
          return {
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            is_gst_free: line.is_gst_free,
            subtotal,
            tax_amount: taxAmount,
            total: subtotal + taxAmount,
          };
        });

        // Load accounting sync data (using raw query to avoid type issues)
        try {
          const { data: syncLogs, error: syncError } = await (supabase as any)
            .from('integration_sync_logs')
            .select('response_data')
            .eq('entity_type', 'invoice')
            .eq('entity_id', documentId)
            .eq('status', 'success')
            .order('synced_at', { ascending: false })
            .limit(1);

          if (syncError) console.error('Sync logs error:', syncError);

          if (syncLogs && syncLogs.length > 0) {
            const responseData = syncLogs[0].response_data as any;
            const accountingLines = responseData?.LineItems || responseData?.Details || [];

            comparisonData.accountingLines = accountingLines.map((line: any) => {
              const subtotal = line.LineAmount || line.Amount || 0;
              const taxAmount = line.TaxAmount || 0;
              return {
                description: line.Description || line.ItemDescription || '',
                quantity: line.Quantity || line.Qty || 0,
                unit_price: line.UnitPrice || line.Price || 0,
                is_gst_free: taxAmount === 0,
                subtotal,
                tax_amount: taxAmount,
                total: subtotal + taxAmount,
              };
            });
          }
        } catch (syncErr) {
          console.error('Error loading sync logs:', syncErr);
        }
      }

      setData(comparisonData);
    } catch (error) {
      console.error('Error loading line items:', error);
      toast.error('Failed to load line item details');
    } finally {
      setLoading(false);
    }
  };

  const compareLineItems = (quote: LineItem, invoice: LineItem, accounting: LineItem) => {
    const differences: string[] = [];

    if (Math.abs((quote?.quantity || 0) - (invoice?.quantity || 0)) > 0.001) {
      differences.push('quantity');
    }
    if (Math.abs((quote?.unit_price || 0) - (invoice?.unit_price || 0)) > 0.01) {
      differences.push('price');
    }
    if (Math.abs((quote?.total || 0) - (invoice?.total || 0)) > 0.01) {
      differences.push('total');
    }
    if (accounting && Math.abs((invoice?.total || 0) - (accounting?.total || 0)) > 0.01) {
      differences.push('accounting');
    }

    return differences;
  };

  const maxLines = Math.max(
    data.quoteLines.length,
    data.invoiceLines.length,
    data.accountingLines.length
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Line Item Comparison</DialogTitle>
          <DialogDescription>
            Detailed comparison of line items across quote, invoice, and accounting system
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead className="w-[200px]">Description</TableHead>
                  <TableHead className="text-right">Quote Qty</TableHead>
                  <TableHead className="text-right">Quote Price</TableHead>
                  <TableHead className="text-right">Quote Total</TableHead>
                  <TableHead className="text-right">Invoice Qty</TableHead>
                  <TableHead className="text-right">Invoice Price</TableHead>
                  <TableHead className="text-right">Invoice Total</TableHead>
                  <TableHead className="text-right">Accounting Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maxLines === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No line items found
                    </TableCell>
                  </TableRow>
                ) : (
                  Array.from({ length: maxLines }).map((_, index) => {
                    const quoteLine = data.quoteLines[index];
                    const invoiceLine = data.invoiceLines[index];
                    const accountingLine = data.accountingLines[index];
                    const differences = compareLineItems(quoteLine, invoiceLine, accountingLine);
                    const hasDiscrepancy = differences.length > 0;

                    return (
                      <TableRow
                        key={index}
                        className={hasDiscrepancy ? 'bg-destructive/5' : ''}
                      >
                        <TableCell>
                          {hasDiscrepancy ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-success" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span>{quoteLine?.description || invoiceLine?.description || accountingLine?.description || '—'}</span>
                            {hasDiscrepancy && (
                              <div className="flex gap-1 flex-wrap">
                                {differences.map(diff => (
                                  <Badge key={diff} variant="destructive" className="text-xs">
                                    {diff}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {quoteLine ? (
                            <span className={differences.includes('quantity') ? 'text-destructive font-semibold' : ''}>
                              {quoteLine.quantity}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {quoteLine ? (
                            <span className={differences.includes('price') ? 'text-destructive font-semibold' : ''}>
                              {formatCurrency(quoteLine.unit_price)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {quoteLine ? (
                            <div className="flex flex-col items-end">
                              <span className={differences.includes('total') ? 'text-destructive font-semibold' : ''}>
                                {formatCurrency(quoteLine.total)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                GST: {formatCurrency(quoteLine.tax_amount)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoiceLine ? (
                            <span className={differences.includes('quantity') ? 'text-destructive font-semibold' : ''}>
                              {invoiceLine.quantity}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoiceLine ? (
                            <span className={differences.includes('price') ? 'text-destructive font-semibold' : ''}>
                              {formatCurrency(invoiceLine.unit_price)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoiceLine ? (
                            <div className="flex flex-col items-end">
                              <span className={differences.includes('total') ? 'text-destructive font-semibold' : ''}>
                                {formatCurrency(invoiceLine.total)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                GST: {formatCurrency(invoiceLine.tax_amount)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {accountingLine ? (
                            <div className="flex flex-col items-end">
                              <span className={differences.includes('accounting') ? 'text-destructive font-semibold' : ''}>
                                {formatCurrency(accountingLine.total)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                GST: {formatCurrency(accountingLine.tax_amount)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
