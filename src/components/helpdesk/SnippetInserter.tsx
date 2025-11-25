import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Calendar, 
  FileText, 
  Package, 
  ChevronDown,
  CheckSquare
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
}

export function SnippetInserter({ ticketId, onInsertSnippet }: SnippetInserterProps) {
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; html: string; type: string } | null>(null);
  const [snippetFormat, setSnippetFormat] = useState<"card" | "text">("card");

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

    // Card format - email-client friendly HTML
    let html = `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="border-left: 4px solid #3b82f6; padding-left: 12px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #111827;">
            Service Order ${so.work_order_number}
          </h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">${so.title}</p>
        </div>
    `;

    if (so.description) {
      html += `
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Description:</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${so.description}</p>
        </div>
      `;
    }

    if (so.preferred_date) {
      html += `
        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500;">
            ${formatDate(new Date(so.preferred_date), 'PP')}
          </span>
        </div>
      `;
    }

    if (lineItems && lineItems.length > 0) {
      html += `
        <div style="margin-bottom: 16px;">
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
      html += `</ul></div>`;
    }

    if (appointments && appointments.length > 0) {
      html += `
        <div style="margin-bottom: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Scheduled Appointments:</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
      `;
      appointments.forEach((apt: any) => {
        html += `
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px;">
            <p style="margin: 0; font-size: 13px; font-weight: 500; color: #111827;">${apt.title}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${formatDate(new Date(apt.start_time), 'PPp')}</p>
            ${apt.location_address ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">📍 ${apt.location_address}</p>` : ''}
          </div>
        `;
      });
      html += `</div></div>`;
    }

    if (purchaseOrders && purchaseOrders.length > 0) {
      html += `
        <div style="margin-bottom: 0;">
          <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Linked Purchase Orders:</p>
          <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
      `;
      purchaseOrders.forEach((po: any) => {
        html += `<li style="margin-bottom: 4px; font-size: 14px; color: #4b5563;">PO ${po.po_number} - ${po.supplier?.name} <span style="color: #6b7280;">(${po.status})</span></li>`;
      });
      html += `</ul></div>`;
    }

    html += `</div>`;
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

    // Card format
    let html = `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 16px 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="border-left: 4px solid #10b981; padding-left: 12px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #111827;">
            📅 ${apt.title}
          </h3>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            ${formatDate(new Date(apt.start_time), 'PPp')} - ${formatDate(new Date(apt.end_time), 'p')}
          </p>
        </div>
    `;

    if (apt.location_address) {
      html += `
        <div style="margin-bottom: 12px; padding: 10px; background-color: #ffffff; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px; color: #4b5563;"><strong>Location:</strong> ${apt.location_address}</p>
        </div>
      `;
    }

    if (apt.description) {
      html += `
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #374151;">Description:</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${apt.description}</p>
        </div>
      `;
    }

    if (apt.notes) {
      html += `
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #374151;">Notes:</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${apt.notes}</p>
        </div>
      `;
    }

    if (apt.service_order) {
      html += `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            Part of Service Order: <strong>${apt.service_order.work_order_number}</strong> - ${apt.service_order.title}
          </p>
        </div>
      `;
    }

    html += `</div>`;
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
      setPreviewDialog({ open: true, html, type: snippetType });
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9">
            <ClipboardList className="h-4 w-4 mr-2" />
            Insert Snippet
            <ChevronDown className="h-3 w-3 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Linked Documents</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {serviceOrders.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Service Orders ({serviceOrders.length})
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {serviceOrders.map((doc: any) => (
                    <DropdownMenuItem
                      key={doc.id}
                      onClick={() => handleInsertSnippet("service_order", doc.document_id, "service_order")}
                    >
                      Insert Service Order
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}

          {appointments.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  Appointments ({appointments.length})
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {appointments.map((doc: any) => (
                    <DropdownMenuItem
                      key={doc.id}
                      onClick={() => handleInsertSnippet("appointment", doc.document_id, "appointment")}
                    >
                      Insert Appointment
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}

          {serviceOrders.length === 0 && appointments.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No linked documents available
            </div>
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
            <RadioGroup value={snippetFormat} onValueChange={(v: any) => setSnippetFormat(v)}>
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
                className="prose prose-sm max-w-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmInsert}>
              Insert Snippet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
