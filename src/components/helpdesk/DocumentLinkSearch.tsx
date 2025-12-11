import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { format } from "date-fns";

interface DocumentLinkSearchProps {
  docType: string;
  ticketId: string;
  customerId?: string | null;
  linkedDocIds?: string[];
  onLinked: () => void;
  onCustomerContactLinked?: (customerId?: string, contactId?: string) => void;
}

export function DocumentLinkSearch({ 
  docType, 
  ticketId, 
  customerId,
  linkedDocIds = [],
  onLinked, 
  onCustomerContactLinked 
}: DocumentLinkSearchProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents-for-linking", docType, customerId, linkedDocIds],
    queryFn: async () => {
      let data: any[] = [];
      
      switch (docType) {
        case "service_order": {
          let query = supabase
            .from("service_orders" as any)
            .select("id, order_number, title, customer_id")
            .order("order_number", { ascending: false });
          
          // Filter by customer if provided
          if (customerId) {
            query = query.eq("customer_id", customerId);
          }
          
          const { data: soData, error } = await query;
          if (error) throw error;
          data = soData || [];
          break;
        }
        
        case "appointment": {
          // If we have a customer, get appointments for that customer's service orders only
          if (customerId) {
            // First get the customer's service order IDs
            const { data: customerSOs, error: soError } = await supabase
              .from("service_orders" as any)
              .select("id, order_number")
              .eq("customer_id", customerId);
            
            if (soError) throw soError;
            
            const soIds = customerSOs?.map((so: any) => so.id) || [];
            
            if (soIds.length === 0) {
              return [];
            }
            
            // Build a map of SO IDs to work order numbers for display
            const soNumberMap = new Map(customerSOs?.map((so: any) => [so.id, so.order_number]) || []);
            
            // Get appointments for those service orders
            const { data: aptData, error: aptError } = await supabase
              .from("appointments")
              .select("id, title, appointment_number, start_time, service_order_id")
              .in("service_order_id", soIds)
              .in("status", ["draft", "published", "checked_in"])
              .order("start_time", { ascending: false });
            
            if (aptError) throw aptError;
            
            // Add the work order number to each appointment
            data = (aptData || []).map((apt: any) => ({
              ...apt,
              work_order_number: soNumberMap.get(apt.service_order_id) || ''
            }));
          } else {
            // No customer filter - get all appointments
            const { data: aptData, error } = await supabase
              .from("appointments")
              .select("id, title, appointment_number, start_time, service_order_id")
              .in("status", ["draft", "published", "checked_in"])
              .order("start_time", { ascending: false });
            
            if (error) throw error;
            data = aptData || [];
          }
          break;
        }
        
        case "quote": {
          let query = supabase
            .from("quotes" as any)
            .select("id, quote_number, customer_id")
            .order("quote_number", { ascending: false });
          
          if (customerId) {
            query = query.eq("customer_id", customerId);
          }
          
          const { data: quoteData, error } = await query;
          if (error) throw error;
          data = quoteData || [];
          break;
        }
        
        case "invoice": {
          let query = supabase
            .from("invoices" as any)
            .select("id, invoice_number, customer_id")
            .eq("invoice_type", "AR")
            .order("invoice_number", { ascending: false });
          
          if (customerId) {
            query = query.eq("customer_id", customerId);
          }
          
          const { data: invData, error } = await query;
          if (error) throw error;
          data = invData || [];
          break;
        }
        
        case "project": {
          let query = supabase
            .from("projects" as any)
            .select("id, name, customer_id")
            .order("name");
          
          if (customerId) {
            query = query.eq("customer_id", customerId);
          }
          
          const { data: projData, error } = await query;
          if (error) throw error;
          data = projData || [];
          break;
        }
        
        case "task": {
          const { data: taskData, error } = await supabase
            .from("tasks" as any)
            .select("id, title")
            .order("created_at", { ascending: false });
          
          if (error) throw error;
          data = taskData || [];
          break;
        }
        
        default:
          return [];
      }

      // Filter out already-linked documents
      return data.filter((doc: any) => !linkedDocIds.includes(doc.id));
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (documentId: string) => {
      // Get user and tenant info
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      const tenantId = profile?.tenant_id;
      
      if (!tenantId) {
        throw new Error("Unable to determine tenant");
      }

      // Link the document
      const { error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .insert({
          ticket_id: ticketId,
          document_type: docType,
          document_id: documentId,
          tenant_id: tenantId,
          created_by: user?.id,
        });
      
      if (error) throw error;

      // If linking an appointment, auto-link its service order
      if (docType === "appointment") {
        const selectedDoc = documents?.find((doc) => doc.id === documentId);
        const serviceOrderId = selectedDoc?.service_order_id;
        
        if (serviceOrderId && !linkedDocIds.includes(serviceOrderId)) {
          // Check if SO is already linked
          const { data: existingLink } = await supabase
            .from("helpdesk_linked_documents" as any)
            .select("id")
            .eq("ticket_id", ticketId)
            .eq("document_type", "service_order")
            .eq("document_id", serviceOrderId)
            .maybeSingle();
          
          if (!existingLink) {
            // Auto-link the service order
            await supabase
              .from("helpdesk_linked_documents" as any)
              .insert({
                ticket_id: ticketId,
                document_type: "service_order",
                document_id: serviceOrderId,
                tenant_id: tenantId,
                created_by: user?.id,
              });
          }
        }
      }

      // Get customer_id from the linked document
      const linkedDoc = documents?.find((doc) => doc.id === documentId);
      if (linkedDoc && onCustomerContactLinked) {
        const docCustomerId = (linkedDoc as any).customer_id;
        
        // Pass through the customer ID - let the database handle validation
        if (docCustomerId) {
          onCustomerContactLinked(docCustomerId, undefined);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Document linked successfully" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
      onLinked();
    },
    onError: (error) => {
      toast({
        title: "Failed to link document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDocumentLabel = (doc: any) => {
    switch (docType) {
      case "service_order":
        return `${doc.order_number || 'Untitled'} - ${doc.title || 'No title'}`;
      case "appointment": {
        const dateStr = doc.start_time 
          ? format(new Date(doc.start_time), "dd/MM/yyyy")
          : "";
        const soNum = doc.work_order_number ? `${doc.work_order_number} - ` : "";
        const aptNum = doc.appointment_number || "";
        const title = doc.title || "Untitled";
        return `${soNum}${aptNum} - ${title}${dateStr ? ` (${dateStr})` : ""}`;
      }
      case "quote":
        return doc.quote_number || "Untitled";
      case "invoice":
        return doc.invoice_number || "Untitled";
      case "project":
        return doc.name || "Untitled";
      case "task":
        return doc.title || "Untitled";
      default:
        return "Untitled";
    }
  };

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>;
  }

  if (!documents?.length) {
    const message = customerId 
      ? `No ${docType.replace('_', ' ')}s found for this customer`
      : `No ${docType.replace('_', ' ')}s available`;
    return <div className="text-xs text-muted-foreground">{message}</div>;
  }

  return (
    <SelectWithSearch
      value=""
      onValueChange={(value) => {
        if (value) {
          linkMutation.mutate(value);
        }
      }}
      options={
        documents?.map((doc) => ({
          value: doc.id,
          label: getDocumentLabel(doc),
        })) || []
      }
      placeholder="Select document to link..."
      searchPlaceholder="Search documents..."
      emptyText="No documents found"
    />
  );
}
