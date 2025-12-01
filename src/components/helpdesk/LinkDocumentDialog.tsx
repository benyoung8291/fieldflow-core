import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LinkDocumentDialogProps {
  ticketId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialDocumentType?: string;
}

export function LinkDocumentDialog({ ticketId, open: controlledOpen, onOpenChange, initialDocumentType }: LinkDocumentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>(initialDocumentType || "");
  const [searchQuery, setSearchQuery] = useState("");

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Update document type when initialDocumentType changes
  useEffect(() => {
    if (initialDocumentType) {
      setDocumentType(initialDocumentType);
    }
  }, [initialDocumentType]);

  // Fetch documents based on selected type
  const { data: documents } = useQuery({
    queryKey: ["documents-for-linking", documentType, searchQuery],
    queryFn: async () => {
      if (!documentType) return [];

      const selectMap: Record<string, string> = {
        service_order: "id, work_order_number, description, customer:customers(name)",
        quote: "id, quote_number, description, customer:customers(name)",
        invoice: "id, invoice_number, customer:customers(name)",
        project: "id, name, customer:customers(name)",
        task: "id, title, description",
        appointment: "id, title, description, start_time",
      };

      const tableMap: Record<string, string> = {
        service_order: "service_orders",
        quote: "quotes",
        invoice: "invoices",
        project: "projects",
        task: "tasks",
        appointment: "appointments",
      };

      const tableName = tableMap[documentType];
      const selectColumns = selectMap[documentType];
      if (!tableName || !selectColumns) return [];

      const searchFieldMap: Record<string, string> = {
        service_order: "work_order_number",
        appointment: "title",
        quote: "quote_number",
        invoice: "invoice_number",
        project: "name",
        task: "title",
      };

      let query = supabase
        .from(tableName as any)
        .select(selectColumns);

      // Add search filter
      if (searchQuery) {
        const searchField = searchFieldMap[documentType];
        if (searchField) {
          query = query.ilike(searchField, `%${searchQuery}%`);
        }
      }

      // For appointments, filter to show relevant status and order by start_time
      if (documentType === "appointment") {
        query = query
          .in("status", ["draft", "published"])
          .order("start_time", { ascending: false });
      } else {
        // Order others by creation or relevant field
        query = query.order("created_at", { ascending: false });
      }

      query = query.limit(50);
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!documentType,
  });

  const linkMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      const tenantId = profile?.tenant_id || "";

      // Fetch document details to cache number and description
      const selectMap: Record<string, string> = {
        service_order: "id, work_order_number, description",
        quote: "id, quote_number, description",
        invoice: "id, invoice_number",
        project: "id, name",
        task: "id, title, description",
        appointment: "id, title, description",
      };

      const tableMap: Record<string, string> = {
        service_order: "service_orders",
        quote: "quotes",
        invoice: "invoices",
        project: "projects",
        task: "tasks",
        appointment: "appointments",
      };

      const tableName = tableMap[documentType];
      const selectColumns = selectMap[documentType];
      const { data: docData } = await supabase
        .from(tableName as any)
        .select(selectColumns)
        .eq("id", documentId)
        .single();

      let documentNumber = "";
      let documentDesc = "";
      
      if (docData) {
        const doc = docData as any;
        if (documentType === "service_order") {
          documentNumber = doc.work_order_number || "";
          documentDesc = doc.description || "";
        } else if (documentType === "quote") {
          documentNumber = doc.quote_number || "";
          documentDesc = doc.description || "";
        } else if (documentType === "invoice") {
          documentNumber = doc.invoice_number || "";
        } else if (documentType === "project") {
          documentNumber = doc.name || "";
        } else if (documentType === "task" || documentType === "appointment") {
          documentNumber = doc.title || "";
          documentDesc = doc.description || "";
        }
      }

      // Get current max display order
      const { data: existingLinks } = await supabase
        .from("helpdesk_linked_documents")
        .select("display_order")
        .eq("ticket_id", ticketId)
        .order("display_order", { ascending: false })
        .limit(1);
      
      const nextOrder = existingLinks && existingLinks.length > 0 ? (existingLinks[0].display_order || 0) + 1 : 0;

      const { error } = await supabase
        .from("helpdesk_linked_documents")
        .insert({
          ticket_id: ticketId,
          document_type: documentType,
          document_id: documentId,
          document_number: documentNumber,
          description: documentDesc,
          display_order: nextOrder,
          tenant_id: tenantId,
          created_by: user?.id,
        });

      if (error) throw error;

      // Auto-link related documents
      if (documentType === "service_order") {
        // Link appointments for this service order
        const { data: appointments } = await supabase
          .from("appointments")
          .select("id, title, description")
          .eq("service_order_id", documentId);

        if (appointments && appointments.length > 0) {
          const appointmentLinks = appointments.map((apt, idx) => ({
            ticket_id: ticketId,
            document_type: "appointment",
            document_id: apt.id,
            document_number: apt.title || "",
            description: apt.description || "",
            display_order: nextOrder + idx + 1,
            tenant_id: tenantId,
            created_by: user?.id,
          }));

          await supabase.from("helpdesk_linked_documents").insert(appointmentLinks);
        }
      } else if (documentType === "quote") {
        // Link project if quote is converted  
        const { data: projectsList } = await supabase
          .from("projects" as any)
          .select("id, name")
          .eq("quote_id", documentId)
          .limit(1);

        if (projectsList && projectsList.length > 0) {
          const project = projectsList[0] as any;
          await supabase.from("helpdesk_linked_documents").insert({
            ticket_id: ticketId,
            document_type: "project",
            document_id: project.id,
            document_number: project.name || "",
            description: "",
            display_order: nextOrder + 1,
            tenant_id: tenantId,
            created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Document linked successfully" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
      setOpen(false);
      setDocumentType("");
      setSearchQuery("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to link document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDocumentLabel = (doc: any) => {
    const customerName = doc?.customer?.name ? ` - ${doc.customer.name}` : "";
    
    if (documentType === "service_order") return `${doc?.work_order_number || ""}${customerName}`;
    if (documentType === "quote") return `${doc?.quote_number || ""}${customerName}`;
    if (documentType === "invoice") return `${doc?.invoice_number || ""}${customerName}`;
    if (documentType === "project") return `${doc?.name || ""}${customerName}`;
    if (documentType === "task") return doc?.title || "";
    if (documentType === "appointment") {
      const startTime = doc?.start_time ? new Date(doc.start_time).toLocaleDateString() : "";
      return `${doc?.title || ""}${startTime ? ` - ${startTime}` : ""}`;
    }
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full h-6 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Link Document
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Document to Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service_order">Service Order</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {documentType && (
            <>
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {documents && documents.length > 0 ? (
                  documents.map((doc: any, idx: number) => (
                    <Button
                      key={doc?.id || idx}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => doc?.id && linkMutation.mutate(doc.id)}
                      disabled={linkMutation.isPending}
                    >
                      <span className="text-xs truncate">{getDocumentLabel(doc)}</span>
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents found
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
