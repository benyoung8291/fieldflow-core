export interface FieldDefinition {
  field: string;
  label: string;
  description?: string;
  category: "header" | "customer" | "items" | "totals" | "footer" | "project" | "service";
}

export const DOCUMENT_TYPE_FIELDS: Record<string, FieldDefinition[]> = {
  quote: [
    // Header
    { field: "quote_number", label: "Quote Number", category: "header" },
    { field: "quote_date", label: "Quote Date", category: "header" },
    { field: "valid_until", label: "Valid Until", category: "header" },
    { field: "status", label: "Status", category: "header" },
    
    // Customer
    { field: "customer.name", label: "Customer Name", category: "customer" },
    { field: "customer.email", label: "Customer Email", category: "customer" },
    { field: "customer.phone", label: "Customer Phone", category: "customer" },
    { field: "customer.address", label: "Customer Address", category: "customer" },
    { field: "customer.abn", label: "Customer ABN", category: "customer" },
    
    // Totals
    { field: "subtotal", label: "Subtotal", category: "totals" },
    { field: "tax_amount", label: "Tax Amount", category: "totals" },
    { field: "total_amount", label: "Total Amount", category: "totals" },
    
    // Footer
    { field: "notes", label: "Notes", category: "footer" },
    { field: "terms_conditions", label: "Terms & Conditions", category: "footer" },
  ],
  
  invoice: [
    // Header
    { field: "invoice_number", label: "Invoice Number", category: "header" },
    { field: "invoice_date", label: "Invoice Date", category: "header" },
    { field: "due_date", label: "Due Date", category: "header" },
    { field: "payment_terms", label: "Payment Terms", category: "header" },
    
    // Customer
    { field: "customer.name", label: "Customer Name", category: "customer" },
    { field: "customer.email", label: "Customer Email", category: "customer" },
    { field: "customer.phone", label: "Customer Phone", category: "customer" },
    { field: "customer.address", label: "Customer Address", category: "customer" },
    { field: "customer.abn", label: "Customer ABN", category: "customer" },
    
    // Totals
    { field: "subtotal", label: "Subtotal", category: "totals" },
    { field: "tax_amount", label: "Tax Amount", category: "totals" },
    { field: "total_amount", label: "Total Amount", category: "totals" },
    { field: "amount_paid", label: "Amount Paid", category: "totals" },
    { field: "balance_due", label: "Balance Due", category: "totals" },
    
    // Footer
    { field: "payment_instructions", label: "Payment Instructions", category: "footer" },
    { field: "notes", label: "Notes", category: "footer" },
  ],
  
  purchase_order: [
    // Header
    { field: "po_number", label: "PO Number", category: "header" },
    { field: "po_date", label: "PO Date", category: "header" },
    { field: "delivery_date", label: "Delivery Date", category: "header" },
    { field: "status", label: "Status", category: "header" },
    
    // Supplier
    { field: "supplier.name", label: "Supplier Name", category: "customer" },
    { field: "supplier.contact", label: "Supplier Contact", category: "customer" },
    { field: "supplier.email", label: "Supplier Email", category: "customer" },
    { field: "supplier.phone", label: "Supplier Phone", category: "customer" },
    { field: "supplier.address", label: "Supplier Address", category: "customer" },
    
    // Project
    { field: "project.name", label: "Project Name", category: "project" },
    { field: "project.number", label: "Project Number", category: "project" },
    { field: "delivery_address", label: "Delivery Address", category: "project" },
    
    // Totals
    { field: "subtotal", label: "Subtotal", category: "totals" },
    { field: "tax_amount", label: "Tax Amount", category: "totals" },
    { field: "total_amount", label: "Total Amount", category: "totals" },
    
    // Footer
    { field: "notes", label: "Notes", category: "footer" },
    { field: "special_instructions", label: "Special Instructions", category: "footer" },
  ],
  
  field_report: [
    // Header
    { field: "report_number", label: "Report Number", category: "header" },
    { field: "report_date", label: "Report Date", category: "header" },
    { field: "site_visit_date", label: "Site Visit Date", category: "header" },
    
    // Customer & Location
    { field: "customer.name", label: "Customer Name", category: "customer" },
    { field: "location.name", label: "Location Name", category: "customer" },
    { field: "location.address", label: "Location Address", category: "customer" },
    
    // Service Order
    { field: "service_order.number", label: "Service Order Number", category: "service" },
    { field: "service_order.description", label: "Service Description", category: "service" },
    { field: "technician.name", label: "Technician Name", category: "service" },
    
    // Report Details
    { field: "work_performed", label: "Work Performed", category: "footer" },
    { field: "findings", label: "Findings", category: "footer" },
    { field: "recommendations", label: "Recommendations", category: "footer" },
    { field: "signature", label: "Signature", category: "footer" },
  ],
};

export const getFieldsByDocumentType = (documentType: string): FieldDefinition[] => {
  return DOCUMENT_TYPE_FIELDS[documentType] || [];
};

export const getFieldsByCategory = (documentType: string, category: string): FieldDefinition[] => {
  return getFieldsByDocumentType(documentType).filter(f => f.category === category);
};
