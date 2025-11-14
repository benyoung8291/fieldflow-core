import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify JWT token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { workflowId, triggerData, tenantId, testMode } = await req.json();
    
    // Verify user belongs to the tenant
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Forbidden' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.tenant_id !== tenantId) {
      console.error('User does not belong to tenant:', { userId: user.id, tenantId, userTenantId: profile.tenant_id });
      return new Response(
        JSON.stringify({ error: 'Forbidden - Invalid tenant access' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Executing workflow:", workflowId, "for tenant:", tenantId, "testMode:", testMode);

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
        test_mode: testMode || false,
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
        message: testMode ? "Test execution started" : "Workflow execution started"
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
      const conditionResult = await evaluateCondition(node, { ...context, supabase });
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

    case "create_checklist": {
      // Create a task with multiple checklist items
      const taskData = {
        tenant_id: tenantId,
        title: finalConfig.title || `Checklist from ${triggerData.sourceType || "workflow"}`,
        description: finalConfig.description || "",
        status: config.status || "pending",
        priority: config.priority || "medium",
        due_date: config.dueDate || null,
        assigned_to: config.assignedTo || triggerData.userId || null,
        linked_module: triggerData.sourceType === "helpdesk_ticket" ? "helpdesk" : config.linkedModule,
        linked_record_id: triggerData.ticketId || triggerData.sourceId || config.linkedRecordId,
        created_by: triggerData.userId || null,
      };

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (taskError) throw taskError;

      // Create checklist items
      const items = config.items || [];
      if (items.length > 0) {
        const checklistItems = items.map((item: string, index: number) => ({
          task_id: task.id,
          title: item,
          is_completed: false,
          item_order: index,
        }));

        const { error: checklistError } = await supabase
          .from("task_checklist_items")
          .insert(checklistItems);

        if (checklistError) throw checklistError;

        // If this is for a helpdesk ticket, also create a timeline message
        if (triggerData.ticketId) {
          await supabase
            .from("helpdesk_messages")
            .insert({
              ticket_id: triggerData.ticketId,
              message_type: "checklist",
              body: "Checklist",
              tenant_id: tenantId,
              task_id: task.id,
              created_by: triggerData.userId,
            });
        }
      }

      createdDocuments.checklist = task;
      return { taskId: task.id, task, itemCount: items.length };
    }

    case "create_note": {
      // Create internal note in helpdesk ticket
      if (!triggerData.ticketId) {
        throw new Error("No ticket ID provided for note creation");
      }

      const { error } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: triggerData.ticketId,
          message_type: "internal_note",
          body: finalConfig.content || finalConfig.body || "Automated note from workflow",
          tenant_id: tenantId,
          created_by: triggerData.userId,
        });

      if (error) throw error;
      
      return { noteCreated: true };
    }

    case "update_ticket_status": {
      if (!triggerData.ticketId) {
        throw new Error("No ticket ID provided for status update");
      }

      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ 
          status: config.newStatus || config.status,
          updated_at: new Date().toISOString()
        })
        .eq("id", triggerData.ticketId);

      if (error) throw error;
      
      return { statusUpdated: true, newStatus: config.newStatus || config.status };
    }

    case "assign_ticket": {
      if (!triggerData.ticketId) {
        throw new Error("No ticket ID provided for assignment");
      }

      const assigneeId = config.assignedTo || config.userId;
      if (!assigneeId) {
        throw new Error("No user ID provided for assignment");
      }

      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({ 
          assigned_to: assigneeId,
          updated_at: new Date().toISOString()
        })
        .eq("id", triggerData.ticketId);

      if (error) throw error;
      
      return { assigned: true, assignedTo: assigneeId };
    }

    case "send_helpdesk_email": {
      // This would call the helpdesk-send-email edge function
      if (!triggerData.ticketId) {
        throw new Error("No ticket ID provided for email");
      }

      const emailData = {
        ticketId: triggerData.ticketId,
        to: finalConfig.toEmail || triggerData.contactEmail,
        subject: finalConfig.subject || "Update on your ticket",
        body: finalConfig.body || finalConfig.content || "",
        tenantId: tenantId,
      };

      // Call the helpdesk-send-email function
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/helpdesk-send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify(emailData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to send email: ${error}`);
      }

      return { emailSent: true };
    }

    default:
      throw new Error(`Unknown action type: ${action_type}`);
  }
}

async function evaluateCondition(node: any, context: any): Promise<boolean> {
  const { config } = node;
  const { triggerData, createdDocuments, supabase } = context;

  // User relationship conditions
  if (config.conditionType === "is_assigned_to_current_user") {
    const assignedTo = triggerData.assigned_to || triggerData.assignedTo;
    const currentUserId = triggerData.userId;
    return assignedTo === currentUserId;
  }

  if (config.conditionType === "is_created_by_current_user") {
    const createdBy = triggerData.created_by || triggerData.createdBy;
    const currentUserId = triggerData.userId;
    return createdBy === currentUserId;
  }

  if (config.conditionType === "has_customer") {
    return !!triggerData.customerId || !!triggerData.customer_id;
  }

  if (config.conditionType === "has_project") {
    return !!triggerData.projectId || !!triggerData.project_id;
  }

  // Field comparison conditions
  if (config.conditionType === "field_comparison") {
    const fieldValue = triggerData[config.field] || createdDocuments[config.documentType]?.[config.field];
    
    switch (config.operator) {
      case "equals":
        return String(fieldValue) === String(config.value);
      case "not_equals":
        return String(fieldValue) !== String(config.value);
      case "greater_than":
        return Number(fieldValue) > Number(config.value);
      case "less_than":
        return Number(fieldValue) < Number(config.value);
      case "contains":
        return String(fieldValue || "").includes(String(config.value));
      default:
        return true;
    }
  }

  // Legacy conditions for backward compatibility
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
