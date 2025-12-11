import { useState } from "react";
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
  onInsertSnippet: (html: string) => void;
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

    // Card format - email-client friendly HTML with explicit border styling
    let html = `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 8px; margin: 16px 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <tr>
          <td style="padding: 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-left: 4px solid #3b82f6; padding-left: 12px; padding-bottom: 16px;">
                  <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #111827;">
                    Service Order ${so.work_order_number}
                  </h3>
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">${so.title}</p>
                </td>
              </tr>
    `;

    if (so.description) {
      html += `
              <tr>
                <td style="padding-bottom: 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Description:</p>
                  <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${so.description}</p>
                </td>
              </tr>
      `;
    }

    if (so.preferred_date) {
      html += `
              <tr>
                <td style="padding-bottom: 12px;">
                  <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500;">
                    ${formatDate(new Date(so.preferred_date), 'PP')}
                  </span>
                </td>
              </tr>
      `;
    }

    if (lineItems && lineItems.length > 0) {
      html += `
              <tr>
                <td style="padding-bottom: 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Services:</p>
                  <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
      `;
      lineItems.forEach((item: any) => {
        html += `<li style="margin-bottom: 4px; font-size: 14px; color: #4b5563;">`;
        html += item.description;
        if (item.quantity > 1) html += ` <span style="color: #6b7280;">(Qty: ${item.quantity})</span>`;
        if (item.estimated_hours) html += ` <span style="color: #6b7280;">- Est. ${item.estimated_hours}hrs</span>`;
        html += `</li>`;
      });
      html += `</ul></td></tr>`;
    }

    if (appointments && appointments.length > 0) {
      html += `
              <tr>
                <td style="padding-bottom: 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Scheduled Appointments:</p>
      `;
      appointments.forEach((apt: any) => {
        html += `
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;">
                    <tr>
                      <td style="padding: 10px;">
                        <p style="margin: 0; font-size: 13px; font-weight: 500; color: #111827;">${apt.title}</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${formatDate(new Date(apt.start_time), 'PPp')}</p>
                        ${apt.location_address ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">📍 ${apt.location_address}</p>` : ''}
                      </td>
                    </tr>
                  </table>
        `;
      });
      html += `</td></tr>`;
    }

    if (purchaseOrders && purchaseOrders.length > 0) {
      html += `
              <tr>
                <td>
                  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Linked Purchase Orders:</p>
                  <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
      `;
      purchaseOrders.forEach((po: any) => {
        html += `<li style="margin-bottom: 4px; font-size: 14px; color: #4b5563;">PO ${po.po_number} - ${po.supplier?.name} <span style="color: #6b7280;">(${po.status})</span></li>`;
      });
      html += `</ul></td></tr>`;
    }

    html += `
            </table>
          </td>
        </tr>
      </table>
    `;
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

    // Card format with table for better email compatibility
    let html = `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 8px; margin: 16px 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <tr>
          <td style="padding: 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-left: 4px solid #10b981; padding-left: 12px; padding-bottom: 16px;">
                  <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #111827;">
                    📅 ${apt.title}
                  </h3>
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    ${formatDate(new Date(apt.start_time), 'PPp')} - ${formatDate(new Date(apt.end_time), 'p')}
                  </p>
                </td>
              </tr>
    `;

    if (apt.location_address) {
      html += `
              <tr>
                <td style="padding-bottom: 12px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 10px; background-color: #ffffff; border-radius: 6px;">
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 13px; color: #4b5563;"><strong>Location:</strong> ${apt.location_address}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
      `;
    }

    if (apt.description) {
      html += `
              <tr>
                <td style="padding-bottom: 12px;">
                  <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #374151;">Description:</p>
                  <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${apt.description}</p>
                </td>
              </tr>
      `;
    }

    if (apt.notes) {
      html += `
              <tr>
                <td style="padding-bottom: 12px;">
                  <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #374151;">Notes:</p>
                  <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${apt.notes}</p>
                </td>
              </tr>
      `;
    }

    if (apt.service_order) {
      html += `
              <tr>
                <td style="padding-top: 12px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">
                    Part of Service Order: <strong>${apt.service_order.work_order_number}</strong> - ${apt.service_order.title}
                  </p>
                </td>
              </tr>
      `;
    }

    html += `
            </table>
          </td>
        </tr>
      </table>
    `;
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
    onInsertSnippet(snippet.content);
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
      onInsertSnippet(previewDialog.html);
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
                dangerouslySetInnerHTML={{ __html: previewDialog?.html || "" }}
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
