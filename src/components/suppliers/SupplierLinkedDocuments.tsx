import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, Receipt, Calendar, DollarSign, 
  ShoppingCart, Clock, CheckCircle2, XCircle
} from "lucide-react";
import { format } from "date-fns";

interface SupplierLinkedDocumentsProps {
  supplierId: string;
}

export default function SupplierLinkedDocuments({ supplierId }: SupplierLinkedDocumentsProps) {
  const navigate = useNavigate();

  // Fetch Purchase Orders
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["supplier-purchase-orders", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, created_at")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });

  // Fetch AP Invoices
  const { data: apInvoices = [] } = useQuery({
    queryKey: ["supplier-ap-invoices", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ap_invoices")
        .select("id, invoice_number, status, total_amount, created_at, invoice_date")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });

  // Fetch Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["supplier-expenses", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, expense_number, status, total_amount, created_at, expense_date")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });

  // Fetch Appointments with subcontractor workers
  const { data: appointments = [] } = useQuery({
    queryKey: ["supplier-appointments", supplierId],
    queryFn: async () => {
      // First get contacts for this supplier that are assignable workers
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("is_assignable_worker", true);
      
      if (contactsError) throw contactsError;
      if (!contacts || contacts.length === 0) return [];

      const contactIds = contacts.map(c => c.id);

      // Get appointment_workers with these contacts
      const { data: appointmentWorkers, error: awError } = await supabase
        .from("appointment_workers")
        .select("appointment_id")
        .in("contact_id", contactIds);

      if (awError) throw awError;
      if (!appointmentWorkers || appointmentWorkers.length === 0) return [];

      const appointmentIds = [...new Set(appointmentWorkers.map(aw => aw.appointment_id))];

      // Fetch the appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select("id, appointment_number, title, status, start_time, end_time")
        .in("id", appointmentIds)
        .order("start_time", { ascending: false })
        .limit(50);

      if (appointmentsError) throw appointmentsError;
      return appointmentsData || [];
    },
    enabled: !!supplierId,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      draft: { variant: "secondary", className: "bg-muted text-muted-foreground" },
      pending: { variant: "outline", className: "bg-warning/10 text-warning border-warning/20" },
      approved: { variant: "outline", className: "bg-success/10 text-success border-success/20" },
      sent: { variant: "outline", className: "bg-info/10 text-info border-info/20" },
      received: { variant: "outline", className: "bg-success/10 text-success border-success/20" },
      completed: { variant: "outline", className: "bg-success/10 text-success border-success/20" },
      cancelled: { variant: "destructive", className: "" },
      rejected: { variant: "destructive", className: "" },
      scheduled: { variant: "outline", className: "bg-info/10 text-info border-info/20" },
      in_progress: { variant: "outline", className: "bg-warning/10 text-warning border-warning/20" },
    };

    const config = statusConfig[status] || { variant: "secondary" as const, className: "" };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const DocumentSection = ({ 
    title, 
    icon: Icon, 
    items, 
    onItemClick, 
    renderItem 
  }: { 
    title: string; 
    icon: React.ElementType;
    items: any[];
    onItemClick: (item: any) => void;
    renderItem: (item: any) => React.ReactNode;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {title}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No {title.toLowerCase()} found</p>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onItemClick(item)}
                >
                  {renderItem(item)}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );

  const hasNoDocuments = 
    purchaseOrders.length === 0 && 
    apInvoices.length === 0 && 
    expenses.length === 0 && 
    appointments.length === 0;

  if (hasNoDocuments) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No linked documents found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DocumentSection
        title="Purchase Orders"
        icon={ShoppingCart}
        items={purchaseOrders}
        onItemClick={(item) => navigate(`/purchase-orders/${item.id}`)}
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{item.po_number}</div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(item.created_at), 'dd MMM yyyy')}
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(item.status)}
              <div className="text-sm font-medium mt-1">
                {formatCurrency(item.total_amount || 0)}
              </div>
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="AP Invoices"
        icon={Receipt}
        items={apInvoices}
        onItemClick={(item) => navigate(`/ap-invoices/${item.id}`)}
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{item.invoice_number}</div>
              <div className="text-sm text-muted-foreground">
                {item.invoice_date ? format(new Date(item.invoice_date), 'dd MMM yyyy') : '-'}
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(item.status)}
              <div className="text-sm font-medium mt-1">
                {formatCurrency(item.total_amount || 0)}
              </div>
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Expenses"
        icon={DollarSign}
        items={expenses}
        onItemClick={(item) => navigate(`/expenses/${item.id}`)}
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{item.expense_number}</div>
              <div className="text-sm text-muted-foreground">
                {item.expense_date ? format(new Date(item.expense_date), 'dd MMM yyyy') : '-'}
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(item.status)}
              <div className="text-sm font-medium mt-1">
                {formatCurrency(item.total_amount || 0)}
              </div>
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Appointments (Subcontractors)"
        icon={Calendar}
        items={appointments}
        onItemClick={(item) => navigate(`/appointments/${item.id}`)}
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{item.appointment_number || item.title}</div>
              <div className="text-sm text-muted-foreground">
                {item.start_time ? format(new Date(item.start_time), 'dd MMM yyyy HH:mm') : '-'}
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(item.status || 'scheduled')}
            </div>
          </div>
        )}
      />
    </div>
  );
}
