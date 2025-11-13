import { supabase } from "@/integrations/supabase/client";

export type WorkflowTriggerType = 
  | "quote_created"
  | "quote_approved"
  | "quote_sent"
  | "invoice_sent"
  | "service_order_completed"
  | "project_created";

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
    userId?: string;
    tenantId?: string;
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
