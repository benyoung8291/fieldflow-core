import { supabase } from "@/integrations/supabase/client";

export type WorkflowTriggerType = 
  | "quote_created"
  | "quote_approved"
  | "quote_sent"
  | "invoice_sent"
  | "service_order_completed"
  | "project_created"
  | "ticket_created"
  | "ticket_assigned"
  | "ticket_status_changed"
  | "ticket_resolved"
  | "ticket_reopened"
  | "email_received"
  | "email_sent"
  | "purchase_order_created"
  | "purchase_order_approved"
  | "expense_submitted"
  | "expense_approved";

interface TriggerWorkflowParams {
  triggerType: WorkflowTriggerType;
  triggerData: {
    sourceType: string;
    sourceId: string;
    customerId?: string;
    projectId?: string;
    serviceOrderId?: string;
    quoteId?: string;
    invoiceId?: string;
    ticketId?: string;
    emailMessageId?: string;
    purchaseOrderId?: string;
    expenseId?: string;
    userId?: string;
    tenantId?: string;
    oldStatus?: string;
    newStatus?: string;
    [key: string]: any;
  };
}

/**
 * Triggers workflows that match the specified trigger type
 * This function should be called when workflow trigger events occur
 */
export async function triggerWorkflows(params: TriggerWorkflowParams): Promise<void> {
  try {
    console.log("Triggering workflows for:", params.triggerType);

    const { data, error } = await supabase.functions.invoke("trigger-workflow", {
      body: {
        triggerType: params.triggerType,
        triggerData: params.triggerData,
      },
    });

    if (error) {
      console.error("Failed to trigger workflows:", error);
      return;
    }

    console.log("Workflows triggered:", data);
  } catch (error) {
    console.error("Error triggering workflows:", error);
  }
}

/**
 * Helper functions for common trigger scenarios
 */

export async function triggerQuoteCreatedWorkflow(
  quoteId: string,
  customerId: string,
  projectId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  // Fetch quote details for additional context
  const { data: quote } = await supabase
    .from("quotes")
    .select("created_by, status, total_amount")
    .eq("id", quoteId)
    .maybeSingle();

  await triggerWorkflows({
    triggerType: "quote_created",
    triggerData: {
      sourceType: "quote",
      sourceId: quoteId,
      quoteId,
      customerId,
      projectId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
      created_by: quote?.created_by,
      status: quote?.status,
      total_amount: quote?.total_amount,
    },
  });
}

export async function triggerQuoteApprovedWorkflow(quoteId: string, customerId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .single();

  await triggerWorkflows({
    triggerType: "quote_approved",
    triggerData: {
      sourceType: "quote",
      sourceId: quoteId,
      quoteId,
      customerId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerProjectCreatedWorkflow(projectId: string, customerId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .single();

  await triggerWorkflows({
    triggerType: "project_created",
    triggerData: {
      sourceType: "project",
      sourceId: projectId,
      projectId,
      customerId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerServiceOrderCompletedWorkflow(
  serviceOrderId: string,
  customerId: string,
  projectId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .single();

  await triggerWorkflows({
    triggerType: "service_order_completed",
    triggerData: {
      sourceType: "service_order",
      sourceId: serviceOrderId,
      serviceOrderId,
      customerId,
      projectId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerInvoiceSentWorkflow(
  invoiceId: string,
  customerId: string,
  projectId?: string,
  serviceOrderId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .single();

  await triggerWorkflows({
    triggerType: "invoice_sent",
    triggerData: {
      sourceType: "invoice",
      sourceId: invoiceId,
      invoiceId,
      customerId,
      projectId,
      serviceOrderId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

/**
 * Helpdesk trigger functions
 */

export async function triggerTicketCreatedWorkflow(
  ticketId: string,
  customerId?: string,
  contactId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  // Fetch ticket details for additional context
  const { data: ticket } = await supabase
    .from("helpdesk_tickets")
    .select("assigned_to, status, priority")
    .eq("id", ticketId)
    .single();

  await triggerWorkflows({
    triggerType: "ticket_created",
    triggerData: {
      sourceType: "helpdesk_ticket",
      sourceId: ticketId,
      ticketId,
      customerId,
      contactId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
      assigned_to: ticket?.assigned_to,
      status: ticket?.status,
      priority: ticket?.priority,
    },
  });
}

export async function triggerTicketStatusChangedWorkflow(
  ticketId: string,
  oldStatus: string,
  newStatus: string,
  customerId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  await triggerWorkflows({
    triggerType: "ticket_status_changed",
    triggerData: {
      sourceType: "helpdesk_ticket",
      sourceId: ticketId,
      ticketId,
      customerId,
      oldStatus,
      newStatus,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerTicketAssignedWorkflow(
  ticketId: string,
  assignedToId: string,
  customerId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  await triggerWorkflows({
    triggerType: "ticket_assigned",
    triggerData: {
      sourceType: "helpdesk_ticket",
      sourceId: ticketId,
      ticketId,
      customerId,
      assignedToId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerEmailReceivedWorkflow(
  ticketId: string,
  messageId: string,
  fromEmail: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  await triggerWorkflows({
    triggerType: "email_received",
    triggerData: {
      sourceType: "helpdesk_message",
      sourceId: messageId,
      ticketId,
      emailMessageId: messageId,
      fromEmail,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerPurchaseOrderCreatedWorkflow(
  purchaseOrderId: string,
  supplierId?: string,
  serviceOrderId?: string,
  projectId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  await triggerWorkflows({
    triggerType: "purchase_order_created",
    triggerData: {
      sourceType: "purchase_order",
      sourceId: purchaseOrderId,
      purchaseOrderId,
      supplierId,
      serviceOrderId,
      projectId,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}

export async function triggerExpenseSubmittedWorkflow(
  expenseId: string,
  submittedBy: string,
  amount: number
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user?.id)
    .maybeSingle();

  await triggerWorkflows({
    triggerType: "expense_submitted",
    triggerData: {
      sourceType: "expense",
      sourceId: expenseId,
      expenseId,
      submittedBy,
      amount,
      userId: user?.id,
      tenantId: profile?.tenant_id,
    },
  });
}
