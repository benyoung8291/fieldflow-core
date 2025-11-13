import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Download, Search, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import LineItemComparisonDialog from '@/components/reconciliation/LineItemComparisonDialog';

interface ReconciliationItem {
  id: string;
  document_type: 'quote' | 'invoice';
  document_number: string;
  customer_name: string;
  quote_total: number | null;
  invoice_total: number | null;
  accounting_total: number | null;
  quote_gst: number | null;
  invoice_gst: number | null;
  accounting_gst: number | null;
  has_discrepancy: boolean;
  discrepancy_amount: number;
  sync_status: string | null;
  sync_date: string | null;
  created_at: string;
}

export default function FinancialReconciliation() {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'discrepancies' | 'synced' | 'unsynced'>('all');
  const [stats, setStats] = useState({
    totalDocuments: 0,
    withDiscrepancies: 0,
    totalDiscrepancyAmount: 0,
    syncedDocuments: 0,
  });
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadReconciliationData();
  }, []);

  const loadReconciliationData = async () => {
    setLoading(true);
    try {
      // Fetch quotes with related invoices and sync logs
      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          total_amount,
          tax_amount,
          subtotal,
          created_at,
          customers (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (quotesError) throw quotesError;

      // Fetch invoices with sync logs
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          tax_amount,
          subtotal,
          quote_id,
          created_at,
          customers (
            name
          ),
          integration_sync_logs (
            status,
            synced_at,
            response_data
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (invoicesError) throw invoicesError;

      // Build reconciliation data
      const reconciliationData: ReconciliationItem[] = [];
      let totalDiscrepancies = 0;
      let totalDiscrepancyAmount = 0;
      let syncedCount = 0;

      // Process invoices
      invoices?.forEach((invoice: any) => {
        const syncLog = invoice.integration_sync_logs?.[0];
        const accountingTotal = syncLog?.response_data?.Total || null;
        const accountingGst = syncLog?.response_data?.TotalTax || null;
        
        // Find related quote
        const relatedQuote = quotes?.find((q: any) => q.id === invoice.quote_id);
        
        // Calculate discrepancy
        const invoiceTotal = invoice.total_amount || 0;
        const quoteTotal = relatedQuote?.total_amount || null;
        let discrepancyAmount = 0;
        
        if (quoteTotal !== null && Math.abs(invoiceTotal - quoteTotal) > 0.01) {
          discrepancyAmount = invoiceTotal - quoteTotal;
        }
        
        if (accountingTotal !== null && Math.abs(invoiceTotal - accountingTotal) > 0.01) {
          discrepancyAmount = Math.max(Math.abs(discrepancyAmount), Math.abs(invoiceTotal - accountingTotal));
        }
        
        const hasDiscrepancy = Math.abs(discrepancyAmount) > 0.01;
        
        if (hasDiscrepancy) {
          totalDiscrepancies++;
          totalDiscrepancyAmount += Math.abs(discrepancyAmount);
        }
        
        if (syncLog?.status === 'success') {
          syncedCount++;
        }

        reconciliationData.push({
          id: invoice.id,
          document_type: 'invoice',
          document_number: invoice.invoice_number,
          customer_name: invoice.customers?.name || 'Unknown',
          quote_total: quoteTotal,
          invoice_total: invoiceTotal,
          accounting_total: accountingTotal,
          quote_gst: relatedQuote?.tax_amount || null,
          invoice_gst: invoice.tax_amount || null,
          accounting_gst: accountingGst,
          has_discrepancy: hasDiscrepancy,
          discrepancy_amount: discrepancyAmount,
          sync_status: syncLog?.status || null,
          sync_date: syncLog?.synced_at || null,
          created_at: invoice.created_at,
        });
      });

      // Process quotes without invoices
      quotes?.forEach((quote: any) => {
        const hasInvoice = invoices?.some((inv: any) => inv.quote_id === quote.id);
        if (!hasInvoice) {
          reconciliationData.push({
            id: quote.id,
            document_type: 'quote',
            document_number: quote.quote_number,
            customer_name: quote.customers?.name || 'Unknown',
            quote_total: quote.total_amount || 0,
            invoice_total: null,
            accounting_total: null,
            quote_gst: quote.tax_amount || null,
            invoice_gst: null,
            accounting_gst: null,
            has_discrepancy: false,
            discrepancy_amount: 0,
            sync_status: null,
            sync_date: null,
            created_at: quote.created_at,
          });
        }
      });

      setItems(reconciliationData);
      setStats({
        totalDocuments: reconciliationData.length,
        withDiscrepancies: totalDiscrepancies,
        totalDiscrepancyAmount,
        syncedDocuments: syncedCount,
      });
    } catch (error) {
      console.error('Error loading reconciliation data:', error);
      toast.error('Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (filterStatus === 'discrepancies') {
      matchesFilter = item.has_discrepancy;
    } else if (filterStatus === 'synced') {
      matchesFilter = item.sync_status === 'success';
    } else if (filterStatus === 'unsynced') {
      matchesFilter = item.document_type === 'invoice' && !item.sync_status;
    }
    
    return matchesSearch && matchesFilter;
  });

  const exportToCSV = () => {
    const headers = [
      'Document Type',
      'Document Number',
      'Customer',
      'Quote Total',
      'Invoice Total',
      'Accounting Total',
      'Discrepancy',
      'Sync Status',
      'Sync Date',
    ];

    const rows = filteredItems.map(item => [
      item.document_type,
      item.document_number,
      item.customer_name,
      item.quote_total?.toFixed(2) || '',
      item.invoice_total?.toFixed(2) || '',
      item.accounting_total?.toFixed(2) || '',
      item.discrepancy_amount.toFixed(2),
      item.sync_status || 'Not Synced',
      item.sync_date ? new Date(item.sync_date).toLocaleDateString() : '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-reconciliation-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported successfully');
  };

  const handleRowClick = (item: ReconciliationItem) => {
    if (item.has_discrepancy) {
      setSelectedItem(item);
      setDialogOpen(true);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial Reconciliation</h1>
            <p className="text-muted-foreground mt-1">
              Compare financial data across quotes, invoices, and accounting syncs
            </p>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Documents</CardDescription>
              <CardTitle className="text-3xl">{stats.totalDocuments}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>With Discrepancies</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {stats.withDiscrepancies}
                {stats.withDiscrepancies > 0 && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Discrepancy</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(stats.totalDiscrepancyAmount)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Synced to Accounting</CardDescription>
              <CardTitle className="text-3xl">{stats.syncedDocuments}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Report</CardTitle>
            <CardDescription>Review and identify financial data discrepancies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by document number or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="discrepancies">With Discrepancies</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="unsynced">Not Synced</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={loadReconciliationData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Quote Total</TableHead>
                      <TableHead className="text-right">Invoice Total</TableHead>
                      <TableHead className="text-right">Accounting Total</TableHead>
                      <TableHead className="text-right">Discrepancy</TableHead>
                      <TableHead>Sync Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No documents found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className={`${item.has_discrepancy ? 'bg-destructive/5 cursor-pointer hover:bg-destructive/10' : ''}`}
                          onClick={() => handleRowClick(item)}
                        >
                          <TableCell>
                            {item.has_discrepancy ? (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-success" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{item.document_number}</span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {item.document_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{item.customer_name}</TableCell>
                          <TableCell className="text-right">
                            {item.quote_total !== null ? (
                              <div className="flex flex-col items-end">
                                <span>{formatCurrency(item.quote_total)}</span>
                                <span className="text-xs text-muted-foreground">
                                  GST: {formatCurrency(item.quote_gst || 0)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.invoice_total !== null ? (
                              <div className="flex flex-col items-end">
                                <span>{formatCurrency(item.invoice_total)}</span>
                                <span className="text-xs text-muted-foreground">
                                  GST: {formatCurrency(item.invoice_gst || 0)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.accounting_total !== null ? (
                              <div className="flex flex-col items-end">
                                <span>{formatCurrency(item.accounting_total)}</span>
                                <span className="text-xs text-muted-foreground">
                                  GST: {formatCurrency(item.accounting_gst || 0)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.abs(item.discrepancy_amount) > 0.01 ? (
                              <span className="font-medium text-destructive">
                                {formatCurrency(Math.abs(item.discrepancy_amount))}
                              </span>
                            ) : (
                              <span className="text-success">$0.00</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.sync_status ? (
                              <Badge variant={item.sync_status === 'success' ? 'default' : 'destructive'}>
                                {item.sync_status}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Not Synced</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LineItemComparisonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        documentId={selectedItem?.id || ''}
        documentType={selectedItem?.document_type || 'invoice'}
        quoteId={selectedItem?.document_type === 'invoice' ? 
          items.find(i => i.document_type === 'quote' && i.id === selectedItem.id)?.id || null 
          : null
        }
      />
    </DashboardLayout>
  );
}
