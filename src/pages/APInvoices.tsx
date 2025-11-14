import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, FileText, Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import APInvoiceDialog from "@/components/invoices/APInvoiceDialog";
import { formatCurrency } from "@/lib/utils";

export default function APInvoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const { data: apInvoices = [], isLoading } = useQuery({
    queryKey: ['ap-invoices'],
    queryFn: async () => {
      // @ts-ignore - Types will update after migration
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          supplier:suppliers(name),
          purchase_order:purchase_orders(po_number)
        `)
        .eq('invoice_type', 'AP')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredInvoices = apInvoices.filter((invoice: any) =>
    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    // @ts-ignore - Types will update after migration
    invoice.supplier_invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMatchingBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Matched</Badge>;
      case 'variance':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Variance</Badge>;
      case 'approved':
        return <Badge className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AP Invoices</h1>
            <p className="text-muted-foreground">
              Accounts Payable - Supplier invoices with 3-way matching
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New AP Invoice
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice #, supplier, or PO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">
                {filteredInvoices.length} invoices
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PO #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Matching Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">
                          {searchTerm ? 'No invoices match your search' : 'No AP invoices yet'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice: any) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                    >
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      {/* @ts-ignore - Types will update after migration */}
                      <TableCell>{invoice.supplier_invoice_number || '-'}</TableCell>
                      <TableCell>{invoice.supplier?.name || '-'}</TableCell>
                      <TableCell>{invoice.purchase_order?.po_number || '-'}</TableCell>
                      <TableCell>
                        {invoice.invoice_date && new Date(invoice.invoice_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date && new Date(invoice.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total_amount || 0)}
                      </TableCell>
                      {/* @ts-ignore - Types will update after migration */}
                      <TableCell>{getMatchingBadge(invoice.matching_status)}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <APInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {}}
      />
    </DashboardLayout>
  );
}
