# Workflow Automation System

## Overview

The workflow automation system enables automatic execution of actions when specific events occur in your application. Workflows consist of trigger nodes, action nodes, and condition nodes connected together to create automated business processes.

## Core Concepts

### Triggers
Events that start workflow execution:
- `quote_created` - When a new quote is created
- `quote_approved` - When a quote is approved
- `quote_sent` - When a quote is sent to customer
- `invoice_sent` - When an invoice is sent
- `service_order_completed` - When a service order is marked complete
- `project_created` - When a new project is created
- `ticket_created` - When a helpdesk ticket is created
- `ticket_assigned` - When a ticket is assigned to a user
- `ticket_status_changed` - When a ticket status changes
- `ticket_resolved` - When a ticket is resolved
- `ticket_reopened` - When a closed ticket is reopened
- `email_received` - When an email is received in helpdesk
- `email_sent` - When an email is sent from helpdesk
- `purchase_order_created` - When a purchase order is created
- `purchase_order_approved` - When a purchase order is approved
- `expense_submitted` - When an expense is submitted
- `expense_approved` - When an expense is approved

### Actions
Operations performed by the workflow:
- `create_project` - Create a new project
- `create_service_order` - Create a new service order
- `create_invoice` - Create a new invoice
- `create_task` - Create a new task
- `create_checklist` - Create a checklist with multiple items
- `create_note` - Create an internal note in helpdesk timeline
- `update_status` - Update document status
- `update_ticket_status` - Update helpdesk ticket status
- `assign_user` - Assign document to user
- `assign_ticket` - Assign helpdesk ticket to user
- `send_email` - Send email
- `send_helpdesk_email` - Send email from helpdesk ticket
- `delay` - Wait before continuing

### Conditions
Branching logic based on data:
- `field_equals` - Check if field equals value
- `field_greater_than` - Check if field is greater than threshold
- `field_less_than` - Check if field is less than threshold
- `field_contains` - Check if field contains text

## Architecture

### Database Tables

**workflows**
- Stores workflow definitions
- Fields: name, description, trigger_type, is_active

**workflow_nodes**
- Individual nodes in the workflow
- Fields: node_type, action_type, config, position

**workflow_connections**
- Connections between nodes
- Fields: source_node_id, target_node_id

**workflow_executions**
- Records of workflow runs
- Fields: workflow_id, status, trigger_data, started_at, completed_at

**workflow_execution_logs**
- Logs for each node execution
- Fields: execution_id, node_id, status, output, error_message

### Edge Functions

**execute-workflow**
- Executes workflow nodes sequentially
- Handles action execution and condition evaluation
- Runs in background after triggering
- Logs all steps for debugging

**trigger-workflow**
- Finds workflows matching trigger type
- Starts workflow execution
- Called from application code when events occur

## Creating Workflows

### Via UI (Workflow Builder)

1. Navigate to `/workflows`
2. Click "New Workflow"
3. Set workflow name and trigger type
4. Drag action nodes from the sidebar
5. Connect nodes to define execution flow
6. Configure each node's settings
7. Save and activate workflow

### Workflow Configuration Example

```typescript
// Example: Quote Approved → Create Project → Create Service Order
{
  trigger: "quote_approved",
  nodes: [
    {
      type: "trigger",
      id: "trigger-1",
      config: { triggerType: "quote_approved" }
    },
    {
      type: "action",
      id: "create-project-1",
      actionType: "create_project",
      config: {
        projectName: "Project from Quote",
        status: "planning",
        description: "Auto-created from approved quote"
      }
    },
    {
      type: "action",
      id: "create-service-order-1",
      actionType: "create_service_order",
      config: {
        title: "Initial Service Order",
        status: "draft"
      }
    }
  ],
  connections: [
    { source: "trigger-1", target: "create-project-1" },
    { source: "create-project-1", target: "create-service-order-1" }
  ]
}
```

## Integrating Triggers

### Step 1: Import trigger function

```typescript
import { triggerQuoteApprovedWorkflow } from "@/lib/workflowTriggers";
```

### Step 2: Call when event occurs

```typescript
// In your quote approval logic
const approveQuote = async (quoteId: string, customerId: string) => {
  // Update quote status
  await supabase
    .from("quotes")
    .update({ status: "approved" })
    .eq("id", quoteId);
  
  // Trigger workflows
  await triggerQuoteApprovedWorkflow(quoteId, customerId);
};
```

### Step 3: Handle errors gracefully

```typescript
try {
  await triggerQuoteApprovedWorkflow(quoteId, customerId);
} catch (error) {
  console.error("Workflow trigger failed:", error);
  // Don't block main operation if workflow fails
}
```

## Action Configuration

### Create Project
```typescript
{
  actionType: "create_project",
  config: {
    projectName: "Project Name",
    description: "Description",
    status: "planning", // or "active", "completed"
    startDate: "2025-01-15",
    customerId: "customer-uuid" // optional, uses trigger data if not specified
  }
}
```

### Create Service Order
```typescript
{
  actionType: "create_service_order",
  config: {
    title: "Service Order Title",
    description: "Description",
    status: "draft", // or "active", "completed"
    customerId: "customer-uuid", // optional
    projectId: "project-uuid" // optional, uses created project if available
  }
}
```

### Create Invoice
```typescript
{
  actionType: "create_invoice",
  config: {
    status: "draft",
    dueDate: "2025-02-15",
    customerId: "customer-uuid", // optional
    projectId: "project-uuid", // optional
    serviceOrderId: "service-order-uuid" // optional
  }
}
```

### Update Status
```typescript
{
  actionType: "update_status",
  config: {
    documentType: "project", // or "serviceOrder", "quote", "invoice"
    documentId: "doc-uuid", // optional, uses trigger data
    newStatus: "active"
  }
}
```

### Assign User
```typescript
{
  actionType: "assign_user",
  config: {
    documentType: "project",
    documentId: "doc-uuid", // optional
    userId: "user-uuid"
  }
}
```

### Delay
```typescript
{
  actionType: "delay",
  config: {
    delayMinutes: 60 // Wait 1 hour before next action
  }
}
```

## Execution Context

The workflow execution maintains a context object that nodes can access:

```typescript
{
  triggerData: {
    sourceType: "quote",
    sourceId: "quote-uuid",
    quoteId: "quote-uuid",
    customerId: "customer-uuid",
    userId: "user-uuid",
    tenantId: "tenant-uuid"
  },
  createdDocuments: {
    project: { id: "...", ... },
    serviceOrder: { id: "...", ... },
    invoice: { id: "...", ... }
  }
}
```

Later actions can reference previously created documents.

## Monitoring & Debugging

### View Executions
1. Open workflow in builder
2. See execution history in the Executions panel
3. Click "View Logs" to see detailed step-by-step execution

### Execution Status
- **Running**: Currently executing
- **Completed**: Finished successfully
- **Failed**: Error occurred during execution

### Log Details
Each log entry shows:
- Node that executed
- Success/failure status
- Output data
- Error message (if failed)
- Timestamp

## Best Practices

1. **Start Simple**: Begin with 2-3 actions, test thoroughly
2. **Test Before Activating**: Use test data to verify workflow behavior
3. **Monitor Executions**: Check execution logs regularly for errors
4. **Handle Failures**: Add conditions to handle edge cases
5. **Use Delays Wisely**: Long delays consume execution time
6. **Document Workflows**: Use descriptive names and descriptions
7. **Version Control**: Keep track of workflow changes over time

## Common Patterns

### Pattern 1: Quote to Project Pipeline
```
Trigger: quote_approved
→ Create Project
→ Create Service Order
→ Assign to Sales Manager
→ Create Initial Tasks
```

### Pattern 2: Automatic Invoicing
```
Trigger: service_order_completed
→ Check if project exists
  → Yes: Create Invoice linked to project
  → No: Create Invoice standalone
→ Send Invoice Email
```

### Pattern 3: Task Automation
```
Trigger: project_created
→ Create Task: "Initial Planning"
→ Create Task: "Resource Allocation"
→ Create Task: "Schedule Kickoff"
→ Assign Tasks to Project Manager
```

## Troubleshooting

### Workflow not triggering
- Check workflow is active
- Verify trigger type matches event
- Confirm trigger function is called in code
- Check execution logs for errors

### Action failing
- Review execution logs for error message
- Verify required fields are provided
- Check permissions and RLS policies
- Ensure referenced documents exist

### Unexpected behavior
- Review workflow configuration
- Check execution context data
- Verify node connections are correct
- Test with simplified workflow first

## Future Enhancements

- Email sending action
- SMS notifications
- Webhook calls
- Advanced conditions (AND/OR logic)
- Parallel execution paths
- Workflow templates library
- Visual execution timeline
- Performance analytics
