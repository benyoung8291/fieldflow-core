import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, X, FileText, Calendar, DollarSign, ClipboardList, CheckSquare, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { LinkDocumentDialog } from "./LinkDocumentDialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LinkedDocumentsSidebarProps {
  ticketId: string;
  ticket: any;
}

interface SortableCardProps {
  doc: any;
  onUnlink: (id: string) => void;
  onView: (type: string, id: string) => void;
  getDocumentIcon: (type: string) => JSX.Element;
}

function SortableCard({ doc, onUnlink, onView, getDocumentIcon }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-card border rounded-md p-3 hover:border-primary/50 transition-all",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-primary">{getDocumentIcon(doc.document_type)}</div>
            <span className="text-xs font-medium capitalize">{doc.document_type.replace("_", " ")}</span>
          </div>
          <p className="text-sm font-medium truncate">{doc.document_number || doc.document_id}</p>
          {doc.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
          )}
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onView(doc.document_type, doc.document_id)}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onUnlink(doc.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LinkedDocumentsSidebar({ ticketId, ticket }: LinkedDocumentsSidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderedDocs, setOrderedDocs] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: linkedDocs } = useQuery({
    queryKey: ["helpdesk-linked-docs", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (linkedDocs) {
      setOrderedDocs(linkedDocs);
    }
  }, [linkedDocs]);

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .delete()
        .eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
      toast({ title: "Document unlinked successfully" });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (docs: any[]) => {
      const updates = docs.map((doc, index) => ({
        id: doc.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("helpdesk_linked_documents" as any)
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-linked-docs", ticketId] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedDocs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        updateOrderMutation.mutate(newOrder);
        return newOrder;
      });
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "service_order": return <ClipboardList className="h-4 w-4" />;
      case "appointment": return <Calendar className="h-4 w-4" />;
      case "quote": return <FileText className="h-4 w-4" />;
      case "invoice": return <DollarSign className="h-4 w-4" />;
      case "project": return <FileText className="h-4 w-4" />;
      case "task": return <CheckSquare className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleViewDocument = (type: string, id: string) => {
    const urlMap: Record<string, string> = {
      service_order: `/service-orders/${id}`,
      appointment: `/appointments/${id}`,
      quote: `/quotes/${id}`,
      invoice: `/invoices/${id}`,
      project: `/projects/${id}`,
      task: `/tasks`,
    };
    
    const url = urlMap[type] || "#";
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="px-3 py-2 border-b">
        <h3 className="font-semibold text-sm mb-2">Linked Documents</h3>
        
        {/* Customer & Contact */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Customer</span>
            {ticket?.customer ? (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {ticket.customer.name}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-5 text-xs px-2">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Link
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Contact</span>
            {ticket?.contact ? (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {ticket.contact.first_name} {ticket.contact.last_name}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-5 text-xs px-2">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Link
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        <LinkDocumentDialog ticketId={ticketId} />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {orderedDocs && orderedDocs.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedDocs.map((doc) => doc.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedDocs.map((doc) => (
                  <SortableCard
                    key={doc.id}
                    doc={doc}
                    onUnlink={(id) => unlinkMutation.mutate(id)}
                    onView={handleViewDocument}
                    getDocumentIcon={getDocumentIcon}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-12">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No documents linked yet</p>
              <p className="text-xs mt-1">Click "Link Document" to get started</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
