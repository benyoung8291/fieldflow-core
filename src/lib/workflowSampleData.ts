import { WorkflowTriggerType } from "./workflowTriggers";

export function getSampleDataForTrigger(triggerType: WorkflowTriggerType): Record<string, any> {
  switch (triggerType) {
    case "quote_created":
      return {
        sourceType: "quote",
        sourceId: "550e8400-e29b-41d4-a716-446655440000",
        quoteId: "550e8400-e29b-41d4-a716-446655440000",
        quoteNumber: "Q-2024-001",
        customerId: "650e8400-e29b-41d4-a716-446655440000",
        customerName: "Acme Corporation",
        status: "draft",
        total_amount: 15750.00,
        created_by: "750e8400-e29b-41d4-a716-446655440000",
        createdByName: "John Smith",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
        createdAt: new Date().toISOString(),
      };

    case "ticket_created":
      return {
        sourceType: "helpdesk_ticket",
        sourceId: "450e8400-e29b-41d4-a716-446655440000",
        ticketId: "450e8400-e29b-41d4-a716-446655440000",
        ticketNumber: "TKT-2024-123",
        subject: "Unable to access dashboard",
        status: "open",
        priority: "high",
        customerId: "650e8400-e29b-41d4-a716-446655440000",
        customerName: "Acme Corporation",
        contactId: "350e8400-e29b-41d4-a716-446655440000",
        contactName: "Jane Doe",
        contactEmail: "jane.doe@acme.com",
        assigned_to: "750e8400-e29b-41d4-a716-446655440000",
        assignedToName: "Support Agent",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
        createdAt: new Date().toISOString(),
      };

    case "ticket_status_changed":
      return {
        sourceType: "helpdesk_ticket",
        sourceId: "450e8400-e29b-41d4-a716-446655440000",
        ticketId: "450e8400-e29b-41d4-a716-446655440000",
        ticketNumber: "TKT-2024-123",
        oldStatus: "open",
        newStatus: "in_progress",
        customerId: "650e8400-e29b-41d4-a716-446655440000",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
      };

    case "invoice_sent":
      return {
        sourceType: "invoice",
        sourceId: "250e8400-e29b-41d4-a716-446655440000",
        invoiceId: "250e8400-e29b-41d4-a716-446655440000",
        invoiceNumber: "INV-2024-456",
        customerId: "650e8400-e29b-41d4-a716-446655440000",
        customerName: "Acme Corporation",
        totalAmount: 25000.00,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        projectId: "150e8400-e29b-41d4-a716-446655440000",
        projectName: "Office Renovation",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
      };

    case "project_created":
      return {
        sourceType: "project",
        sourceId: "150e8400-e29b-41d4-a716-446655440000",
        projectId: "150e8400-e29b-41d4-a716-446655440000",
        projectName: "Office Renovation",
        projectNumber: "PRJ-2024-789",
        customerId: "650e8400-e29b-41d4-a716-446655440000",
        customerName: "Acme Corporation",
        budget: 50000.00,
        startDate: new Date().toISOString(),
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
      };

    case "purchase_order_created":
      return {
        sourceType: "purchase_order",
        sourceId: "950e8400-e29b-41d4-a716-446655440000",
        purchaseOrderId: "950e8400-e29b-41d4-a716-446655440000",
        poNumber: "PO-2024-321",
        supplierId: "1050e8400-e29b-41d4-a716-446655440000",
        supplierName: "Materials Supplier Inc",
        totalAmount: 8500.00,
        status: "pending",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
      };

    case "email_received":
      return {
        sourceType: "helpdesk_message",
        sourceId: "1150e8400-e29b-41d4-a716-446655440000",
        emailMessageId: "1150e8400-e29b-41d4-a716-446655440000",
        ticketId: "450e8400-e29b-41d4-a716-446655440000",
        fromEmail: "customer@acme.com",
        fromName: "Jane Doe",
        subject: "Re: Unable to access dashboard",
        body: "I'm still having issues accessing the system...",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
      };

    case "expense_submitted":
      return {
        sourceType: "expense",
        sourceId: "1250e8400-e29b-41d4-a716-446655440000",
        expenseId: "1250e8400-e29b-41d4-a716-446655440000",
        amount: 450.00,
        category: "Travel",
        description: "Client meeting travel expenses",
        submittedBy: "750e8400-e29b-41d4-a716-446655440000",
        submittedByName: "John Smith",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
      };

    default:
      return {
        sourceType: "generic",
        sourceId: "000e8400-e29b-41d4-a716-446655440000",
        userId: "750e8400-e29b-41d4-a716-446655440000",
        tenantId: "850e8400-e29b-41d4-a716-446655440000",
        timestamp: new Date().toISOString(),
      };
  }
}
