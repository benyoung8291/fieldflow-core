import { useState } from "react";
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
}

export function LinkDocumentDialog({ ticketId }: LinkDocumentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch documents based on selected type
  const { data: documents } = useQuery({
    queryKey: ["documents-for-linking", documentType, searchQuery],
    queryFn: async () => {
      if (!documentType) return [];

      const tableMap: Record<string, string> = {
        service_order: "service_orders",
        quote: "quotes",
        invoice: "invoices",
        project: "projects",
        task: "tasks",
        appointment: "appointments",
      };

      const tableName = tableMap[documentType];
      if (!tableName) return [];

      const { data, error } = await supabase
        .from(tableName as any)
        .select("id, work_order_number, quote_number, invoice_number, name, title, description")
        .limit(20);
      
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

      // Fetch document details to cache number and description
      const tableMap: Record<string, string> = {
        service_order: "service_orders",
        quote: "quotes",
        invoice: "invoices",
        project: "projects",
        task: "tasks",
        appointment: "appointments",
      };

      const tableName = tableMap[documentType];
      const { data: docData } = await supabase
        .from(tableName as any)
        .select("id, work_order_number, quote_number, invoice_number, name, title, description")
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
          tenant_id: profile?.tenant_id || "",
          created_by: user?.id,
        });

      if (error) throw error;
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
    if (documentType === "service_order") return `${doc?.work_order_number || ""} - ${doc?.description || ""}`;
    if (documentType === "quote") return `${doc?.quote_number || ""} - ${doc?.description || ""}`;
    if (documentType === "invoice") return `${doc?.invoice_number || ""}`;
    if (documentType === "project") return doc?.name || "";
    if (documentType === "task") return doc?.title || "";
    if (documentType === "appointment") return doc?.title || "";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-6 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Link Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Document</DialogTitle>
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
