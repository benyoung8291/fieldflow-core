/**
 * WORKFLOW INTEGRATION EXAMPLES
 * 
 * This file demonstrates how to integrate workflow triggers into your application.
 * Copy these patterns into the relevant parts of your codebase.
 */

import { triggerWorkflows, triggerQuoteApprovedWorkflow, triggerProjectCreatedWorkflow } from "@/lib/workflowTriggers";

/**
 * Example 1: Trigger workflow when quote is approved
 * Add this to your quote approval logic (e.g., in QuoteDetails.tsx)
 */
export async function exampleQuoteApproval(quoteId: string, customerId: string) {
  // Your existing quote approval logic
  // ... update quote status to "approved"
  
  // Trigger workflows
  await triggerQuoteApprovedWorkflow(quoteId, customerId);
}

/**
 * Example 2: Trigger workflow when project is created
 * Add this to your project creation logic (e.g., in ProjectDialog.tsx)
 */
export async function exampleProjectCreation(projectId: string, customerId: string) {
  // Your existing project creation logic
  // ... create project record
  
  // Trigger workflows
  await triggerProjectCreatedWorkflow(projectId, customerId);
}

/**
 * Example 3: Custom trigger with additional data
 * For any custom scenario where you need more control
 */
export async function exampleCustomTrigger() {
  await triggerWorkflows({
    triggerType: "service_order_completed",
    triggerData: {
      sourceType: "service_order",
      sourceId: "some-service-order-id",
      serviceOrderId: "some-service-order-id",
      customerId: "some-customer-id",
      projectId: "some-project-id", // optional
      
      // Add any custom data your workflow needs
      priority: "high",
      value: 15000,
      tags: ["urgent", "vip"],
    },
  });
}

/**
 * INTEGRATION CHECKLIST:
 * 
 * 1. Find where the trigger event occurs in your app
 *    Examples:
 *    - Quote approval: QuoteDetails.tsx or quote status update mutation
 *    - Project creation: ProjectDialog.tsx after successful insert
 *    - Service order completion: ServiceOrderDetails.tsx when marking complete
 *    - Invoice sending: InvoiceDetails.tsx when sending to customer
 * 
 * 2. Import the appropriate trigger function:
 *    import { triggerQuoteApprovedWorkflow } from "@/lib/workflowTriggers";
 * 
 * 3. Call the trigger function with required data:
 *    await triggerQuoteApprovedWorkflow(quoteId, customerId);
 * 
 * 4. Make sure to handle errors appropriately:
 *    try {
 *      await triggerQuoteApprovedWorkflow(quoteId, customerId);
 *    } catch (error) {
 *      console.error("Failed to trigger workflows:", error);
 *      // Workflow failure shouldn't block the main operation
 *    }
 * 
 * 5. Test your integration:
 *    - Create a workflow with the trigger type
 *    - Activate the workflow
 *    - Perform the action that triggers it
 *    - Check workflow executions in the workflow builder
 */
