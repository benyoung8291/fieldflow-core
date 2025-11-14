import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SelectWithSearch } from "@/components/ui/select-with-search";

interface DocumentLinkSearchProps {
  docType: string;
  ticketId: string;
  onLinked: () => void;
  onCustomerContactLinked?: (customerId?: string, contactId?: string) => void;
}

export function DocumentLinkSearch({ docType, ticketId, onLinked, onCustomerContactLinked }: DocumentLinkSearchProps) {
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents-for-linking", docType],
    queryFn: async () => {
      let query: any;
      let selectFields = "id";
      
      switch (docType) {
        case "service_order":
          selectFields = "id, order_number, customer_id, contact_id";
          query = supabase.from("service_orders" as any).select(selectFields).order("order_number", { ascending: false });
          break;
        case "appointment":
          selectFields = "id, title, customer_id, contact_id";
          query = supabase.from("appointments").select(selectFields).order("created_at", { ascending: false });
          break;
        case "quote":
          selectFields = "id, quote_number, customer_id, contact_id";
          query = supabase.from("quotes" as any).select(selectFields).order("quote_number", { ascending: false });
          break;
        case "invoice":
          selectFields = "id, invoice_number, customer_id, contact_id";
          query = supabase.from("invoices" as any).select(selectFields).eq("invoice_type", "AR").order("invoice_number", { ascending: false });
          break;
        case "project":
          selectFields = "id, name, customer_id, contact_id";
          query = supabase.from("projects" as any).select(selectFields).order("name");
          break;
        case "task":
          selectFields = "id, title";
          query = supabase.from("tasks" as any).select(selectFields).order("created_at", { ascending: false });
          break;
        default:
          return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (documentId: string) => {
      // Link the document
      const { error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .insert({
          ticket_id: ticketId,
          document_type: docType,
          document_id: documentId,
        });
      
      if (error) throw error;

      // Get customer_id and contact_id from the linked document
      const linkedDoc = documents?.find((doc) => doc.id === documentId);
      if (linkedDoc && onCustomerContactLinked) {
        const customerId = (linkedDoc as any).customer_id;
        const contactId = (linkedDoc as any).contact_id;
        
        // Pass through the IDs - let the database handle validation
        if (customerId || contactId) {
          onCustomerContactLinked(customerId, contactId);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Document linked successfully" });
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
        return doc.order_number || "Untitled";
      case "appointment":
        return doc.title || "Untitled";
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
