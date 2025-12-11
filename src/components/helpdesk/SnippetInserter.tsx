import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SaveSnippetAsNoteDialog } from "./SaveSnippetAsNoteDialog";
import { 
  ClipboardList, 
  Calendar, 
  FileText, 
  Package, 
  ChevronDown,
  CheckSquare,
  FolderKanban,
  Pin,
  Settings2,
  BookOpen
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format as formatDate } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface SnippetInserterProps {
  ticketId: string;
  onInsertSnippet: (html: string, metadata?: { type: string; id: string; title: string }) => void;
  onOpenSnippetManager?: () => void;
}

interface EmailSnippet {
  id: string;
  name: string;
  content: string;
  category: string | null;
  is_shared: boolean;
}

export function SnippetInserter({ ticketId, onInsertSnippet, onOpenSnippetManager }: SnippetInserterProps) {
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; html: string; type: string; docId: string; docType: string } | null>(null);
  const [snippetFormat, setSnippetFormat] = useState<"card" | "text">("card");
  const [saveAsNoteDialog, setSaveAsNoteDialog] = useState<{ open: boolean; docType: string; docId: string; content: string } | null>(null);

  // Fetch custom email snippets
  const { data: customSnippets } = useQuery({
    queryKey: ["email-snippets-for-inserter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_snippets")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as EmailSnippet[];
    },
  });

  const { data: linkedDocs } = useQuery({
    queryKey: ["helpdesk-linked-docs-snippets", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_linked_documents" as any)
        .select("*")
        .eq("ticket_id", ticketId);

      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch service order details for labels
  const serviceOrderIds = linkedDocs?.filter(d => d.document_type === "service_order").map(d => d.document_id) || [];
  const { data: serviceOrderDetails } = useQuery({
    queryKey: ["service-order-details-for-snippets", serviceOrderIds],
    queryFn: async () => {
      if (serviceOrderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, work_order_number, title")
        .in("id", serviceOrderIds);
      if (error) throw error;
      return data;
    },
    enabled: serviceOrderIds.length > 0,
  });

  // Fetch appointment details for labels
  const appointmentIds = linkedDocs?.filter(d => d.document_type === "appointment").map(d => d.document_id) || [];
  const { data: appointmentDetails } = useQuery({
    queryKey: ["appointment-details-for-snippets", appointmentIds],
    queryFn: async () => {
      if (appointmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_number, title")
        .in("id", appointmentIds);
      if (error) throw error;
      return data;
    },
    enabled: appointmentIds.length > 0,
  });

  // Fetch project details for labels
  const projectIds = linkedDocs?.filter(d => d.document_type === "project").map(d => d.document_id) || [];
  const { data: projectDetails } = useQuery({
    queryKey: ["project-details-for-snippets", projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: projectIds.length > 0,
  });

  const generateServiceOrderSnippet = async (docId: string, format: "card" | "text") => {
    const { data: so } = await supabase
      .from("service_orders")
      .select(`
        work_order_number,
        title,
        description,
        preferred_date,
        status,
        customer:customers(name),
        location:customer_locations(name, address, city, state, postcode)
      `)
      .eq("id", docId)
      .single();

    if (!so) return null;

    // Fetch line items (without financial data)
    const { data: lineItems } = await supabase
      .from("service_order_line_items")
      .select("description, quantity, estimated_hours")
      .eq("service_order_id", docId)
      .order("item_order");

    // Fetch appointments
    const { data: appointments } = await supabase
      .from("appointments")
      .select("title, start_time, end_time, status, location_address")
      .eq("service_order_id", docId)
      .order("start_time");

    // Fetch linked purchase orders
    const { data: purchaseOrders } = await supabase
      .from("purchase_orders")
      .select("po_number, status, supplier:suppliers(name)")
      .eq("service_order_id", docId)
      .order("created_at");

    if (format === "text") {
      let text = `Service Order: ${so.work_order_number}\n`;
      text += `Title: ${so.title}\n`;
      if (so.description) text += `\nDescription:\n${so.description}\n`;
      if (so.preferred_date) text += `\nPreferred Date: ${formatDate(new Date(so.preferred_date), 'PP')}\n`;
      
      if (lineItems && lineItems.length > 0) {
        text += `\nServices:\n`;
        lineItems.forEach((item: any, idx: number) => {
          text += `${idx + 1}. ${item.description}`;
          if (item.quantity > 1) text += ` (Qty: ${item.quantity})`;
          if (item.estimated_hours) text += ` - Est. ${item.estimated_hours}hrs`;
          text += `\n`;
        });
      }

      if (appointments && appointments.length > 0) {
        text += `\nScheduled Appointments:\n`;
        appointments.forEach((apt: any, idx: number) => {
          text += `${idx + 1}. ${apt.title} - ${formatDate(new Date(apt.start_time), 'PPp')}\n`;
          if (apt.location_address) text += `   Location: ${apt.location_address}\n`;
        });
      }

      if (purchaseOrders && purchaseOrders.length > 0) {
        text += `\nLinked Purchase Orders:\n`;
        purchaseOrders.forEach((po: any, idx: number) => {
          text += `${idx + 1}. PO ${po.po_number} - ${po.supplier?.name} (${po.status})\n`;
        });
      }

      return `<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;">${text}</pre>`;
    }

    // Card format - clean, compact card matching app's card style
    const statusColor = so.status === 'completed' ? '#16a34a' : so.status === 'scheduled' ? '#f59e0b' : '#6b7280';
    const statusBg = so.status === 'completed' ? '#dcfce7' : so.status === 'scheduled' ? '#fef3c7' : '#f3f4f6';
    const statusLabel = so.status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Draft';
    
    const totalHours = lineItems?.reduce((sum: number, item: any) => sum + (item.estimated_hours || 0), 0) || 0;
    const locationData = so.location as any;
    const locationName = locationData?.name || locationData?.address || '';
    const customerData = so.customer as any;
    const customerName = customerData?.name || '';

    let html = `<div style="display:inline-block;border:1px solid #e5e7eb;border-radius:8px;background:#fff;margin:4px 0;max-width:360px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
<div style="display:flex;">
<div style="width:4px;background:#3b82f6;border-radius:8px 0 0 8px;flex-shrink:0;"></div>
<div style="flex:1;padding:10px 12px;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">
<div style="font-size:13px;font-weight:600;color:#111827;">W/O: ${so.work_order_number}</div>
${totalHours > 0 ? `<div style="font-size:11px;color:#6b7280;white-space:nowrap;margin-left:8px;">${totalHours}h</div>` : ''}
</div>
<div style="font-size:12px;color:#374151;margin-bottom:2px;">${locationName}</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">${customerName}</div>
<div style="display:flex;gap:4px;flex-wrap:wrap;">
<span style="background:${statusBg};color:${statusColor};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">${statusLabel}</span>
<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">Service Order</span>
</div>
</div>
</div>
</div>`;
    return html;
  };

  const generateAppointmentSnippet = async (docId: string, format: "card" | "text") => {
    const { data: apt } = await supabase
      .from("appointments")
      .select(`
        title,
        description,
        start_time,
        end_time,
        status,
        location_address,
        notes,
        service_order:service_orders(work_order_number, title)
      `)
      .eq("id", docId)
      .single();

    if (!apt) return null;

    if (format === "text") {
      let text = `Appointment: ${apt.title}\n`;
      text += `Time: ${formatDate(new Date(apt.start_time), 'PPp')} - ${formatDate(new Date(apt.end_time), 'p')}\n`;
      if (apt.location_address) text += `Location: ${apt.location_address}\n`;
      if (apt.description) text += `\nDescription:\n${apt.description}\n`;
      if (apt.notes) text += `\nNotes:\n${apt.notes}\n`;
      if (apt.service_order) text += `\nService Order: ${apt.service_order.work_order_number} - ${apt.service_order.title}\n`;
      return `<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;">${text}</pre>`;
    }

    // Card format - clean, compact card matching app's card style
    const aptStatus = apt.status as string;
    const statusColor = aptStatus === 'completed' ? '#16a34a' : aptStatus === 'checked_in' ? '#f59e0b' : '#6b7280';
    const statusBg = aptStatus === 'completed' ? '#dcfce7' : aptStatus === 'checked_in' ? '#fef3c7' : '#f3f4f6';
    const statusLabel = aptStatus?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Scheduled';
    
    const duration = Math.round((new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60) * 10) / 10;
    const dateStr = formatDate(new Date(apt.start_time), 'EEE, MMM d');
    const timeStr = `${formatDate(new Date(apt.start_time), 'h:mm a')} - ${formatDate(new Date(apt.end_time), 'h:mm a')}`;

    let html = `<div style="display:inline-block;border:1px solid #e5e7eb;border-radius:8px;background:#fff;margin:4px 0;max-width:360px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
<div style="display:flex;">
<div style="width:4px;background:#10b981;border-radius:8px 0 0 8px;flex-shrink:0;"></div>
<div style="flex:1;padding:10px 12px;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">
<div style="font-size:13px;font-weight:600;color:#111827;">${apt.title}</div>
<div style="font-size:11px;color:#6b7280;white-space:nowrap;margin-left:8px;">${duration}h</div>
</div>
<div style="font-size:12px;color:#374151;margin-bottom:2px;">${dateStr}</div>
<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">${timeStr}</div>
${apt.location_address ? `<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">📍 ${apt.location_address}</div>` : ''}
<div style="display:flex;gap:4px;flex-wrap:wrap;">
<span style="background:${statusBg};color:${statusColor};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">${statusLabel}</span>
<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;">Appointment</span>
</div>
</div>
</div>
</div>`;
    return html;
  };

  const handleInsertSnippet = async (docType: string, docId: string, snippetType: string) => {
    let html: string | null = null;

    if (docType === "service_order") {
      html = await generateServiceOrderSnippet(docId, snippetFormat);
    } else if (docType === "appointment") {
      html = await generateAppointmentSnippet(docId, snippetFormat);
    }

    if (html) {
      setPreviewDialog({ open: true, html, type: snippetType, docId, docType });
    }
  };

  const handleInsertCustomSnippet = (snippet: EmailSnippet) => {
    // Check if content is already HTML (has tags) or plain text
    const isHtml = /<[a-z][\s\S]*>/i.test(snippet.content);
    
    if (isHtml) {
      // Already HTML, insert directly
      onInsertSnippet(snippet.content);
    } else {
      // Plain text - convert newlines to proper HTML paragraphs
      const htmlContent = snippet.content
        .split('\n')
        .map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>')
        .join('');
      onInsertSnippet(htmlContent);
    }
  };

  const handleSaveAsNote = () => {
    if (previewDialog) {
      // Strip HTML for plain text note
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = previewDialog.html;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      
      setSaveAsNoteDialog({
        open: true,
        docType: previewDialog.docType,
        docId: previewDialog.docId,
        content: plainText,
      });
      setPreviewDialog(null);
    }
  };

  const confirmInsert = () => {
    if (previewDialog?.html) {
      onInsertSnippet(previewDialog.html, {
        type: previewDialog.docType,
        id: previewDialog.docId,
        title: previewDialog.type
      });
      setPreviewDialog(null);
    }
  };

  const serviceOrders = linkedDocs?.filter(d => d.document_type === "service_order") || [];
  const appointments = linkedDocs?.filter(d => d.document_type === "appointment") || [];
  const projects = linkedDocs?.filter(d => d.document_type === "project") || [];

  // Group custom snippets by category
  const snippetsByCategory = customSnippets?.reduce((acc, snippet) => {
    const category = snippet.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(snippet);
    return acc;
  }, {} as Record<string, EmailSnippet[]>) || {};

  const hasCustomSnippets = customSnippets && customSnippets.length > 0;
  const hasLinkedDocs = serviceOrders.length > 0 || appointments.length > 0 || projects.length > 0;

  // Get service order label
  const getServiceOrderLabel = (docId: string) => {
    const so = serviceOrderDetails?.find(s => s.id === docId);
    if (so) {
      return `${so.work_order_number} - ${so.title || 'Service Order'}`;
    }
    return "Insert Service Order";
  };

  // Get appointment label
  const getAppointmentLabel = (docId: string) => {
    const apt = appointmentDetails?.find(a => a.id === docId);
    if (apt) {
      return `${apt.appointment_number || 'APT'} - ${apt.title || 'Appointment'}`;
    }
    return "Insert Appointment";
  };

  // Get project label
  const getProjectLabel = (docId: string) => {
    const proj = projectDetails?.find(p => p.id === docId);
    if (proj) {
      return proj.name || 'Project';
    }
    return "Insert Project";
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8">
            <ClipboardList className="h-4 w-4 mr-2" />
            Insert Snippet
            <ChevronDown className="h-3 w-3 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {/* Custom Snippets Section */}
          {hasCustomSnippets && (
            <>
              <DropdownMenuLabel className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                Saved Snippets
              </DropdownMenuLabel>
              {Object.entries(snippetsByCategory).map(([category, snippets]) => (
                <DropdownMenuSub key={category}>
                  <DropdownMenuSubTrigger className="text-sm">
                    {category} ({snippets.length})
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {snippets.map((snippet) => (
                      <DropdownMenuItem
                        key={snippet.id}
                        onClick={() => handleInsertCustomSnippet(snippet)}
                        className="text-sm"
                      >
                        {snippet.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Linked Documents Section */}
          {hasLinkedDocs && (
            <>
              <DropdownMenuLabel>Linked Documents</DropdownMenuLabel>
              
              {serviceOrders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Service Orders ({serviceOrders.length})
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {serviceOrders.map((doc: any) => (
                      <DropdownMenuItem
                        key={doc.id}
                        onClick={() => handleInsertSnippet("service_order", doc.document_id, "service_order")}
                        className="text-sm"
                      >
                        {getServiceOrderLabel(doc.document_id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {appointments.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Calendar className="h-4 w-4 mr-2" />
                    Appointments ({appointments.length})
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {appointments.map((doc: any) => (
                      <DropdownMenuItem
                        key={doc.id}
                        onClick={() => handleInsertSnippet("appointment", doc.document_id, "appointment")}
                        className="text-sm"
                      >
                        {getAppointmentLabel(doc.document_id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {projects.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Projects ({projects.length})
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {projects.map((doc: any) => (
                      <DropdownMenuItem
                        key={doc.id}
                        onClick={() => handleInsertSnippet("project", doc.document_id, "project")}
                        className="text-sm"
                      >
                        {getProjectLabel(doc.document_id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {!hasCustomSnippets && !hasLinkedDocs && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No snippets available
            </div>
          )}

          {/* Manage Snippets */}
          {onOpenSnippetManager && (
            <DropdownMenuItem onClick={onOpenSnippetManager} className="text-sm">
              <Settings2 className="h-4 w-4 mr-2" />
              Manage Snippets
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={previewDialog?.open || false} onOpenChange={(open) => !open && setPreviewDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Snippet</DialogTitle>
            <DialogDescription>
              Choose how to insert this snippet into your email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup 
              value={snippetFormat} 
              onValueChange={async (v: any) => {
                setSnippetFormat(v);
                // Regenerate preview with new format
                if (previewDialog) {
                  let html: string | null = null;
                  if (previewDialog.docType === "service_order") {
                    html = await generateServiceOrderSnippet(previewDialog.docId, v);
                  } else if (previewDialog.docType === "appointment") {
                    html = await generateAppointmentSnippet(previewDialog.docId, v);
                  }
                  if (html) {
                    setPreviewDialog({ ...previewDialog, html });
                  }
                }
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="cursor-pointer">
                  Card Format (Formatted and visually appealing)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text" className="cursor-pointer">
                  Text Format (Plain text, maximum compatibility)
                </Label>
              </div>
            </RadioGroup>

            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Preview:</p>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(previewDialog?.html || "", {
                    ALLOWED_TAGS: [
                      'div', 'span', 'p', 'br', 'strong', 'b', 'em', 'i', 'u',
                      'table', 'thead', 'tbody', 'tr', 'th', 'td',
                      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
                    ],
                    ALLOWED_ATTR: ['style', 'class', 'href', 'target', 'rel']
                  })
                }}
                className="prose prose-sm max-w-none [&_table]:border [&_table]:border-border [&_table]:rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-between gap-2 mt-4">
            <Button variant="outline" onClick={handleSaveAsNote}>
              <Pin className="h-4 w-4 mr-2" />
              Save as Note
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreviewDialog(null)}>
                Cancel
              </Button>
              <Button onClick={confirmInsert}>
                Insert Snippet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {saveAsNoteDialog && (
        <SaveSnippetAsNoteDialog
          open={saveAsNoteDialog.open}
          onOpenChange={(open) => !open && setSaveAsNoteDialog(null)}
          documentType={saveAsNoteDialog.docType as "service_order" | "appointment" | "project"}
          documentId={saveAsNoteDialog.docId}
          initialContent={saveAsNoteDialog.content}
        />
      )}
    </>
  );
}
