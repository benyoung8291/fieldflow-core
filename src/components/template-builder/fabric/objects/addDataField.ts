import { Textbox } from "fabric";

export const addDataField = (
  canvas: any,
  field: string = "customer.name",
  label: string = "Customer Name"
) => {
  const dataField = new Textbox(`{{${field}}}`, {
    left: 100,
    top: 100,
    width: 200,
    fontSize: 14,
    fontFamily: "monospace",
    fill: "hsl(var(--foreground))",
    backgroundColor: "hsl(var(--muted) / 0.3)",
    stroke: "hsl(var(--border))",
    strokeWidth: 1,
    strokeDashArray: [5, 5],
    editable: false,
    customType: "dataField",
    fieldName: field,
  } as any);

  canvas.add(dataField);
  canvas.setActiveObject(dataField);
  canvas.renderAll();
  
  return dataField;
};

export const getDataFieldsByDocumentType = (documentType: string): { field: string; label: string }[] => {
  const commonFields = [
    { field: "company.name", label: "Company Name" },
    { field: "company.address", label: "Company Address" },
    { field: "company.city", label: "Company City" },
    { field: "company.state", label: "Company State" },
    { field: "company.postcode", label: "Company Postcode" },
    { field: "company.phone", label: "Company Phone" },
    { field: "company.email", label: "Company Email" },
    { field: "company.abn", label: "Company ABN" },
    { field: "document.number", label: "Document Number" },
    { field: "document.date", label: "Document Date" },
  ];

  const customerFields = [
    { field: "customer.name", label: "Customer Name" },
    { field: "customer.address", label: "Customer Address" },
    { field: "customer.city", label: "Customer City" },
    { field: "customer.state", label: "Customer State" },
    { field: "customer.postcode", label: "Customer Postcode" },
    { field: "customer.phone", label: "Customer Phone" },
    { field: "customer.email", label: "Customer Email" },
    { field: "customer.abn", label: "Customer ABN" },
  ];

  const supplierFields = [
    { field: "supplier.name", label: "Supplier Name" },
    { field: "supplier.address", label: "Supplier Address" },
    { field: "supplier.city", label: "Supplier City" },
    { field: "supplier.state", label: "Supplier State" },
    { field: "supplier.postcode", label: "Supplier Postcode" },
    { field: "supplier.phone", label: "Supplier Phone" },
    { field: "supplier.email", label: "Supplier Email" },
    { field: "supplier.abn", label: "Supplier ABN" },
  ];

  switch (documentType) {
    case "quote":
      return [
        ...commonFields,
        ...customerFields,
        { field: "quote.valid_until", label: "Valid Until" },
        { field: "quote.reference", label: "Quote Reference" },
        { field: "quote.subtotal", label: "Subtotal" },
        { field: "quote.tax", label: "Tax/GST" },
        { field: "quote.total", label: "Total Amount" },
        { field: "quote.notes", label: "Notes" },
        { field: "quote.terms", label: "Terms & Conditions" },
      ];
    case "invoice":
      return [
        ...commonFields,
        ...customerFields,
        { field: "invoice.due_date", label: "Due Date" },
        { field: "invoice.reference", label: "Invoice Reference" },
        { field: "invoice.subtotal", label: "Subtotal" },
        { field: "invoice.tax", label: "Tax/GST" },
        { field: "invoice.total", label: "Total Amount" },
        { field: "invoice.amount_paid", label: "Amount Paid" },
        { field: "invoice.balance_due", label: "Balance Due" },
        { field: "invoice.payment_terms", label: "Payment Terms" },
        { field: "invoice.notes", label: "Notes" },
      ];
    case "purchase_order":
      return [
        ...commonFields,
        ...supplierFields,
        { field: "po.delivery_date", label: "Delivery Date" },
        { field: "po.reference", label: "PO Reference" },
        { field: "po.subtotal", label: "Subtotal" },
        { field: "po.tax", label: "Tax/GST" },
        { field: "po.total", label: "Total Amount" },
        { field: "po.shipping_address", label: "Shipping Address" },
        { field: "po.notes", label: "Notes" },
        { field: "po.terms", label: "Terms & Conditions" },
      ];
    case "field_report":
      return [
        ...commonFields,
        { field: "report.site", label: "Site Location" },
        { field: "report.technician", label: "Technician Name" },
        { field: "report.date", label: "Report Date" },
        { field: "report.time", label: "Report Time" },
        { field: "report.findings", label: "Findings" },
        { field: "report.recommendations", label: "Recommendations" },
        { field: "report.work_performed", label: "Work Performed" },
        { field: "report.equipment", label: "Equipment Used" },
        { field: "report.weather", label: "Weather Conditions" },
        { field: "report.signature", label: "Signature" },
      ];
    default:
      return commonFields;
  }
};
