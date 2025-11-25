import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { StickyNote, CheckSquare, FileText, Calendar, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailTextSelectorProps {
  ticketId: string;
  children: React.ReactNode;
}

export function EmailTextSelector({ ticketId, children }: EmailTextSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedText, setSelectedText] = useState("");

  const { data: linkedDocs } = useQuery({
    queryKey: ["helpdesk-linked-docs-save", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .select("*")
        .eq("ticket_id", ticketId);

      if (error) throw error;
      return data as any[];
    },
  });

  const handleContextMenu = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    setSelectedText(text || "");
  }, []);

  const saveToDocumentMutation = useMutation({
    mutationFn: async ({ docType, docId, field, text }: { docType: string; docId: string; field: string; text: string }) => {
      // If saving to notes, create a document note instead
      if (field === "notes") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!profile) throw new Error("Profile not found");

        const { error } = await supabase
          .from("document_notes")
          .insert({
            tenant_id: profile.tenant_id,
            document_type: docType,
            document_id: docId,
            content: text,
            is_sticky: false,
            created_by: user.id,
          });

        if (error) throw error;
      } else {
        // For other fields, append to existing content
        if (docType === "service_order") {
          const { data: current } = await supabase
            .from("service_orders")
            .select(field)
            .eq("id", docId)
            .single();

          const currentValue = current?.[field] || "";
          const newValue = currentValue ? `${currentValue}\n\n${text}` : text;

          const { error } = await supabase
            .from("service_orders")
            .update({ [field]: newValue })
            .eq("id", docId);

          if (error) throw error;
        } else if (docType === "appointment") {
          const { data: current } = await supabase
            .from("appointments")
            .select(field)
            .eq("id", docId)
            .single();

          const currentValue = current?.[field] || "";
          const newValue = currentValue ? `${currentValue}\n\n${text}` : text;

          const { error } = await supabase
            .from("appointments")
            .update({ [field]: newValue })
            .eq("id", docId);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Text saved to document" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs-save", ticketId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save text",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ docType, docId, text }: { docType: string; docId: string; text: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const linkedModule = docType === "service_order" ? "service_order" : "appointment";

      const { error } = await supabase
        .from("tasks")
        .insert([{
          title: text.length > 100 ? text.substring(0, 97) + "..." : text,
          description: text,
          tenant_id: profile.tenant_id,
          created_by: user.id,
          linked_module: linkedModule,
          linked_record_id: docId,
          status: "pending",
          priority: "medium",
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Task created from selection" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const serviceOrders = linkedDocs?.filter(d => d.document_type === "service_order") || [];
  const appointments = linkedDocs?.filter(d => d.document_type === "appointment") || [];

  if (!linkedDocs || linkedDocs.length === 0) {
    return <>{children}</>;
  }

  return (
    <ContextMenu onOpenChange={handleContextMenu}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {selectedText && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              "{selectedText.length > 50 ? selectedText.substring(0, 50) + "..." : selectedText}"
            </div>
            <ContextMenuSeparator />

            {/* Service Orders */}
            {serviceOrders.length > 0 && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Save to Service Order
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    {serviceOrders.map((doc: any) => (
                      <ContextMenuSub key={doc.id}>
                        <ContextMenuSubTrigger>
                          Service Order
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                          <ContextMenuItem
                            onClick={() =>
                              saveToDocumentMutation.mutate({
                                docType: "service_order",
                                docId: doc.document_id,
                                field: "description",
                                text: selectedText,
                              })
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Add to Description
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() =>
                              saveToDocumentMutation.mutate({
                                docType: "service_order",
                                docId: doc.document_id,
                                field: "notes",
                                text: selectedText,
                              })
                            }
                          >
                            <StickyNote className="h-4 w-4 mr-2" />
                            Add to Notes
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() =>
                              createTaskMutation.mutate({
                                docType: "service_order",
                                docId: doc.document_id,
                                text: selectedText,
                              })
                            }
                          >
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Create Task
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
              </>
            )}

            {/* Appointments */}
            {appointments.length > 0 && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Calendar className="h-4 w-4 mr-2" />
                    Save to Appointment
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-56">
                    {appointments.map((doc: any) => (
                      <ContextMenuSub key={doc.id}>
                        <ContextMenuSubTrigger>
                          Appointment
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                          <ContextMenuItem
                            onClick={() =>
                              saveToDocumentMutation.mutate({
                                docType: "appointment",
                                docId: doc.document_id,
                                field: "description",
                                text: selectedText,
                              })
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Add to Description
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() =>
                              saveToDocumentMutation.mutate({
                                docType: "appointment",
                                docId: doc.document_id,
                                field: "notes",
                                text: selectedText,
                              })
                            }
                          >
                            <StickyNote className="h-4 w-4 mr-2" />
                            Add to Notes
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() =>
                              createTaskMutation.mutate({
                                docType: "appointment",
                                docId: doc.document_id,
                                text: selectedText,
                              })
                            }
                          >
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Create Task
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </>
            )}

            {serviceOrders.length === 0 && appointments.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No linked documents to save to
              </div>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
