import { WorkflowTriggerType } from "./workflowTriggers";
import { supabase } from "@/integrations/supabase/client";

export async function getSampleDataForTrigger(triggerType: WorkflowTriggerType): Promise<Record<string, any> | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  if (!profile?.tenant_id) return null;

  const tenantId = profile.tenant_id;

  try {
    switch (triggerType) {
      case "quote_created":
      case "quote_approved":
      case "quote_sent": {
        const { data } = await supabase
          .from("quotes")
          .select("*, customers(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "quote",
          sourceId: data.id,
          quoteId: data.id,
          quoteNumber: data.quote_number,
          customerId: data.customer_id,
          customerName: data.customers?.name,
          status: data.status,
          total_amount: data.total_amount,
          created_by: data.created_by,
          userId: user?.id,
          tenantId: tenantId,
          createdAt: data.created_at,
        };
      }

      case "ticket_created":
      case "ticket_assigned":
      case "ticket_status_changed":
      case "ticket_resolved":
      case "ticket_reopened": {
        const { data } = await supabase
          .from("helpdesk_tickets")
          .select("*, customers(name), contacts(first_name, last_name, email)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        const contactName = data.contacts 
          ? `${data.contacts.first_name || ''} ${data.contacts.last_name || ''}`.trim()
          : null;

        return {
          sourceType: "helpdesk_ticket",
          sourceId: data.id,
          ticketId: data.id,
          ticketNumber: data.ticket_number,
          subject: data.subject,
          status: data.status,
          priority: data.priority,
          customerId: data.customer_id,
          customerName: data.customers?.name,
          contactId: data.contact_id,
          contactName: contactName,
          contactEmail: data.contacts?.email,
          assigned_to: data.assigned_to,
          userId: user?.id,
          tenantId: tenantId,
          createdAt: data.created_at,
        };
      }

      case "invoice_sent": {
        const { data } = await supabase
          .from("invoices")
          .select("*, customers(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "invoice",
          sourceId: data.id,
          invoiceId: data.id,
          invoiceNumber: data.invoice_number,
          customerId: data.customer_id,
          customerName: data.customers?.name,
          totalAmount: data.total_amount,
          dueDate: data.due_date,
          userId: user?.id,
          tenantId: tenantId,
        };
      }

      case "project_created": {
        const { data } = await supabase
          .from("projects")
          .select("*, customers(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "project",
          sourceId: data.id,
          projectId: data.id,
          projectName: data.name,
          customerId: data.customer_id,
          customerName: data.customers?.name,
          budget: data.budget,
          startDate: data.start_date,
          userId: user?.id,
          tenantId: tenantId,
        };
      }

      case "purchase_order_created":
      case "purchase_order_approved": {
        const { data } = await supabase
          .from("purchase_orders")
          .select("*, suppliers(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "purchase_order",
          sourceId: data.id,
          purchaseOrderId: data.id,
          poNumber: data.po_number,
          supplierId: data.supplier_id,
          supplierName: data.suppliers?.name,
          totalAmount: data.total_amount,
          status: data.status,
          userId: user?.id,
          tenantId: tenantId,
        };
      }

      case "email_received":
      case "email_sent": {
        const { data } = await supabase
          .from("helpdesk_messages")
          .select("*, helpdesk_tickets(id, ticket_number)")
          .eq("tenant_id", tenantId)
          .eq("message_type", "email")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "helpdesk_message",
          sourceId: data.id,
          emailMessageId: data.id,
          ticketId: data.ticket_id,
          ticketNumber: data.helpdesk_tickets?.ticket_number,
          fromEmail: data.from_email,
          subject: data.subject,
          body: data.body,
          userId: user?.id,
          tenantId: tenantId,
        };
      }

      case "expense_submitted":
      case "expense_approved": {
        const { data } = await supabase
          .from("expenses")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "expense",
          sourceId: data.id,
          expenseId: data.id,
          amount: data.amount,
          description: data.description,
          submittedBy: data.submitted_by,
          userId: user?.id,
          tenantId: tenantId,
        };
      }

      case "service_order_completed": {
        const { data } = await supabase
          .from("service_orders")
          .select("*, customers(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return null;

        return {
          sourceType: "service_order",
          sourceId: data.id,
          serviceOrderId: data.id,
          title: data.title,
          customerId: data.customer_id,
          customerName: data.customers?.name,
          status: data.status,
          userId: user?.id,
          tenantId: tenantId,
        };
      }

      default:
        return {
          sourceType: "generic",
          sourceId: "sample-id",
          userId: user?.id,
          tenantId: tenantId,
          timestamp: new Date().toISOString(),
        };
    }
  } catch (error) {
    console.error("Error loading sample data:", error);
    return null;
  }
}
