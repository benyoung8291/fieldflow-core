import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  FolderKanban, 
  Receipt, 
  Calendar, 
  ClipboardList,
  Mail,
  ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CustomerLinkedDocumentsProps {
  customerId: string;
}

export default function CustomerLinkedDocuments({ customerId }: CustomerLinkedDocumentsProps) {
  const navigate = useNavigate();

  // Fetch contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["customer-contracts", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["customer-projects", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ["customer-invoices", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ["customer-appointments", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service_orders!inner (
            customer_id
          )
        `)
        .eq("service_orders.customer_id", customerId)
        .order("start_time", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch quotes
  const { data: quotes = [] } = useQuery({
    queryKey: ["customer-quotes", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch service orders
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["customer-service-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch helpdesk tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ["customer-tickets", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
      active: { label: "Active", className: "bg-success/10 text-success" },
      completed: { label: "Completed", className: "bg-success/10 text-success" },
      cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
      sent: { label: "Sent", className: "bg-info/10 text-info" },
      approved: { label: "Approved", className: "bg-success/10 text-success" },
      pending: { label: "Pending", className: "bg-warning/10 text-warning" },
      scheduled: { label: "Scheduled", className: "bg-info/10 text-info" },
      in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
      open: { label: "Open", className: "bg-info/10 text-info" },
      closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const DocumentSection = ({ 
    title, 
    icon, 
    items, 
    onItemClick,
    renderItem 
  }: { 
    title: string; 
    icon: React.ReactNode; 
    items: any[]; 
    onItemClick: (id: string) => void;
    renderItem: (item: any) => React.ReactNode;
  }) => {
    if (items.length === 0) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title} ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onItemClick(item.id)}
                >
                  <div className="flex-1 min-w-0">
                    {renderItem(item)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemClick(item.id);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <DocumentSection
        title="Service Contracts"
        icon={<FileText className="h-4 w-4" />}
        items={contracts}
        onItemClick={(id) => navigate(`/service-contracts/${id}`)}
        renderItem={(contract) => (
          <div>
            <div className="font-medium">{contract.contract_number}</div>
            <div className="text-sm text-muted-foreground">
              Created {formatDistanceToNow(new Date(contract.created_at), { addSuffix: true })}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(contract.status)}
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Projects"
        icon={<FolderKanban className="h-4 w-4" />}
        items={projects}
        onItemClick={(id) => navigate(`/projects/${id}`)}
        renderItem={(project) => (
          <div>
            <div className="font-medium">{project.project_number || project.name}</div>
            <div className="text-sm text-muted-foreground">
              {project.name}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(project.status)}
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Quotes"
        icon={<FileText className="h-4 w-4" />}
        items={quotes}
        onItemClick={(id) => navigate(`/quotes/${id}`)}
        renderItem={(quote) => (
          <div>
            <div className="font-medium">{quote.quote_number}</div>
            <div className="text-sm text-muted-foreground">
              ${quote.total_amount?.toFixed(2)} • {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(quote.status)}
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Invoices"
        icon={<Receipt className="h-4 w-4" />}
        items={invoices}
        onItemClick={(id) => navigate(`/invoices/${id}`)}
        renderItem={(invoice) => (
          <div>
            <div className="font-medium">{invoice.invoice_number}</div>
            <div className="text-sm text-muted-foreground">
              ${invoice.total_amount?.toFixed(2)} • {formatDistanceToNow(new Date(invoice.invoice_date), { addSuffix: true })}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(invoice.status)}
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Service Orders"
        icon={<ClipboardList className="h-4 w-4" />}
        items={serviceOrders}
        onItemClick={(id) => navigate(`/service-orders/${id}`)}
        renderItem={(order) => (
          <div>
            <div className="font-medium">{order.order_number}</div>
            <div className="text-sm text-muted-foreground">
              {order.description || "No description"} • {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(order.status)}
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Appointments"
        icon={<Calendar className="h-4 w-4" />}
        items={appointments}
        onItemClick={(id) => navigate(`/appointments/${id}`)}
        renderItem={(appointment) => (
          <div>
            <div className="font-medium">{appointment.title}</div>
            <div className="text-sm text-muted-foreground">
              {new Date(appointment.start_time).toLocaleString()}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(appointment.status)}
            </div>
          </div>
        )}
      />

      <DocumentSection
        title="Help Desk Tickets"
        icon={<Mail className="h-4 w-4" />}
        items={tickets}
        onItemClick={(id) => navigate(`/helpdesk?ticket=${id}`)}
        renderItem={(ticket) => (
          <div>
            <div className="font-medium">{ticket.subject}</div>
            <div className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </div>
            <div className="flex gap-2 mt-1">
              {getStatusBadge(ticket.status)}
            </div>
          </div>
        )}
      />

      {contracts.length === 0 && 
       projects.length === 0 && 
       invoices.length === 0 && 
       appointments.length === 0 && 
       quotes.length === 0 &&
       serviceOrders.length === 0 &&
       tickets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No linked documents found for this customer</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
