import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { workflowId, triggerData, tenantId } = await req.json();

    console.log("Executing workflow:", workflowId, "for tenant:", tenantId);

    // Fetch workflow with nodes and connections
    const { data: workflow, error: workflowError } = await supabaseClient
      .from("workflows")
      .select(`
        *,
        workflow_nodes(*),
        workflow_connections(*)
      `)
      .eq("id", workflowId)
      .eq("is_active", true)
      .single();

    if (workflowError || !workflow) {
      throw new Error(`Workflow not found or inactive: ${workflowError?.message}`);
    }

    // Create execution record
    const { data: execution, error: executionError } = await supabaseClient
      .from("workflow_executions")
      .insert({
        workflow_id: workflowId,
        tenant_id: tenantId,
        trigger_data: triggerData,
        status: "running",
      })
      .select()
      .single();

    if (executionError) {
      throw new Error(`Failed to create execution: ${executionError.message}`);
    }

    // Execute workflow in background (fire and forget)
    executeWorkflowNodes(supabaseClient, workflow, execution.id, triggerData, tenantId)
      .catch(err => console.error("Background execution error:", err));

    return new Response(
      JSON.stringify({ 
        success: true, 
        executionId: execution.id,
        message: "Workflow execution started"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Workflow execution error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

async function executeWorkflowNodes(
  supabase: any,
  workflow: any,
  executionId: string,
  triggerData: any,
  tenantId: string
) {
  try {
    const nodes = workflow.workflow_nodes || [];
    const connections = workflow.workflow_connections || [];

    // Find trigger node (starting point)
    const triggerNode = nodes.find((n: any) => n.node_type === "trigger");
    if (!triggerNode) {
      throw new Error("No trigger node found in workflow");
    }

    // Build execution graph
    const nodeMap: Map<string, any> = new Map(nodes.map((n: any) => [n.node_id, n]));
    const connectionMap = new Map<string, string[]>();
    
    connections.forEach((conn: any) => {
      const targets = connectionMap.get(conn.source_node_id) || [];
      targets.push(conn.target_node_id);
      connectionMap.set(conn.source_node_id, targets);
    });

    // Execute nodes starting from trigger
    const executionContext = {
      triggerData,
      tenantId,
      createdDocuments: {} as Record<string, any>,
    };

    await executeNode(
      supabase,
      triggerNode,
      executionId,
      executionContext,
      nodeMap,
      connectionMap
    );

    // Mark execution as completed
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    console.log("Workflow execution completed:", executionId);
  } catch (error) {
    console.error("Workflow execution failed:", error);
    
    // Mark execution as failed
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);
  }
}

async function executeNode(
  supabase: any,
  node: any,
  executionId: string,
  context: any,
  nodeMap: Map<string, any>,
  connectionMap: Map<string, string[]>
): Promise<void> {
  console.log("Executing node:", node.node_id, "type:", node.node_type);

  try {
    let output: any = {};
    let nextNodeIds: string[] = [];

    if (node.node_type === "trigger") {
      output = { triggered: true, data: context.triggerData };
      nextNodeIds = connectionMap.get(node.node_id) || [];
    } else if (node.node_type === "action") {
      output = await executeAction(supabase, node, context);
      nextNodeIds = connectionMap.get(node.node_id) || [];
    } else if (node.node_type === "condition") {
      const conditionResult = await evaluateCondition(node, context);
      output = { conditionMet: conditionResult };
      
      // Get connections based on condition result
      const allConnections = connectionMap.get(node.node_id) || [];
      nextNodeIds = allConnections; // Simplified - in production, filter by handle
    }

    // Log successful execution
    await supabase.from("workflow_execution_logs").insert({
      execution_id: executionId,
      node_id: node.node_id,
      status: "success",
      output,
    });

    // Execute next nodes
    for (const nextNodeId of nextNodeIds) {
      const nextNode = nodeMap.get(nextNodeId);
      if (nextNode) {
        await executeNode(supabase, nextNode, executionId, context, nodeMap, connectionMap);
      }
    }
  } catch (error) {
    console.error("Node execution failed:", node.node_id, error);
    
    // Log failed execution
    await supabase.from("workflow_execution_logs").insert({
      execution_id: executionId,
      node_id: node.node_id,
      status: "failed",
      error_message: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

async function executeAction(supabase: any, node: any, context: any): Promise<any> {
  const { action_type, config } = node;
  const { tenantId, triggerData, createdDocuments } = context;

  console.log("Executing action:", action_type, "config:", config);

  switch (action_type) {
    case "create_project": {
      const projectData = {
        tenant_id: tenantId,
        name: config.projectName || `Project from ${triggerData.sourceType || "workflow"}`,
        description: config.description || "",
        status: config.status || "planning",
        start_date: config.startDate || new Date().toISOString().split("T")[0],
        customer_id: triggerData.customerId || config.customerId,
        created_by: triggerData.userId || null,
      };

      const { data: project, error } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      if (error) throw error;
      
      createdDocuments.project = project;
      return { projectId: project.id, project };
    }

    case "create_service_order": {
      const serviceOrderData = {
        tenant_id: tenantId,
        title: config.title || `Service Order from ${triggerData.sourceType || "workflow"}`,
        description: config.description || "",
        status: config.status || "draft",
        customer_id: triggerData.customerId || config.customerId,
        project_id: createdDocuments.project?.id || triggerData.projectId || config.projectId,
        created_by: triggerData.userId || null,
      };

      const { data: serviceOrder, error } = await supabase
        .from("service_orders")
        .insert(serviceOrderData)
        .select()
        .single();

      if (error) throw error;
      
      createdDocuments.serviceOrder = serviceOrder;
      return { serviceOrderId: serviceOrder.id, serviceOrder };
    }

    case "create_invoice": {
      // Get next invoice number
      const { data: settings } = await supabase
        .from("invoice_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      const nextNumber = (settings?.next_invoice_number || 1);
      const prefix = settings?.invoice_prefix || "INV";
      const invoiceNumber = `${prefix}-${String(nextNumber).padStart(5, "0")}`;

      const invoiceData = {
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        customer_id: triggerData.customerId || config.customerId,
        project_id: createdDocuments.project?.id || triggerData.projectId || config.projectId,
        service_order_id: createdDocuments.serviceOrder?.id || triggerData.serviceOrderId || config.serviceOrderId,
        status: config.status || "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: config.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        created_by: triggerData.userId || null,
      };

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert(invoiceData)
        .select()
        .single();

      if (error) throw error;

      // Update next invoice number
      await supabase
        .from("invoice_settings")
        .update({ next_invoice_number: nextNumber + 1 })
        .eq("tenant_id", tenantId);
      
      createdDocuments.invoice = invoice;
      return { invoiceId: invoice.id, invoice };
    }

    case "create_task": {
      const taskData = {
        tenant_id: tenantId,
        title: config.title || `Task from ${triggerData.sourceType || "workflow"}`,
        description: config.description || "",
        status: config.status || "pending",
        priority: config.priority || "medium",
        due_date: config.dueDate || null,
        assigned_to: config.assignedTo || triggerData.userId || null,
        project_id: createdDocuments.project?.id || triggerData.projectId || config.projectId,
        service_order_id: createdDocuments.serviceOrder?.id || triggerData.serviceOrderId || config.serviceOrderId,
        created_by: triggerData.userId || null,
      };

      const { data: task, error } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;
      
      return { taskId: task.id, task };
    }

    case "update_status": {
      const { documentType, documentId, newStatus } = config;
      const targetId = documentId || createdDocuments[documentType]?.id || triggerData[`${documentType}Id`];

      if (!targetId) {
        throw new Error(`No document ID found for ${documentType}`);
      }

      const tableName = documentType === "serviceOrder" ? "service_orders" : `${documentType}s`;
      
      const { error } = await supabase
        .from(tableName)
        .update({ status: newStatus })
        .eq("id", targetId);

      if (error) throw error;
      
      return { updated: true, documentType, documentId: targetId, newStatus };
    }

    case "assign_user": {
      const { documentType, documentId, userId } = config;
      const targetId = documentId || createdDocuments[documentType]?.id || triggerData[`${documentType}Id`];
      const assigneeId = userId || triggerData.assignedTo || config.assignedTo;

      if (!targetId || !assigneeId) {
        throw new Error("Missing document ID or user ID for assignment");
      }

      const tableName = documentType === "serviceOrder" ? "service_orders" : `${documentType}s`;
      
      const { error } = await supabase
        .from(tableName)
        .update({ assigned_to: assigneeId })
        .eq("id", targetId);

      if (error) throw error;
      
      return { assigned: true, documentType, documentId: targetId, userId: assigneeId };
    }

    case "delay": {
      const delayMs = config.delayMinutes ? config.delayMinutes * 60 * 1000 : 60000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return { delayed: true, delayMs };
    }

    case "send_email": {
      // Email sending would integrate with your email system
      console.log("Email sending not yet implemented");
      return { emailSent: false, reason: "Not implemented" };
    }

    default:
      throw new Error(`Unknown action type: ${action_type}`);
  }
}

async function evaluateCondition(node: any, context: any): Promise<boolean> {
  const { config } = node;
  const { triggerData, createdDocuments } = context;

  // Simple condition evaluation - can be extended
  if (config.conditionType === "field_equals") {
    const value = triggerData[config.fieldName] || createdDocuments[config.documentType]?.[config.fieldName];
    return value === config.expectedValue;
  }

  if (config.conditionType === "field_greater_than") {
    const value = Number(triggerData[config.fieldName] || createdDocuments[config.documentType]?.[config.fieldName]);
    return value > Number(config.threshold);
  }

  if (config.conditionType === "field_less_than") {
    const value = Number(triggerData[config.fieldName] || createdDocuments[config.documentType]?.[config.fieldName]);
    return value < Number(config.threshold);
  }

  if (config.conditionType === "field_contains") {
    const value = String(triggerData[config.fieldName] || createdDocuments[config.documentType]?.[config.fieldName] || "");
    return value.includes(config.searchText);
  }

  // Default to true if no condition configured
  return true;
}
