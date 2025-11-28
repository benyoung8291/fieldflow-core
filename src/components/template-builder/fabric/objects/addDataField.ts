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
    { field: "company.phone", label: "Company Phone" },
    { field: "company.email", label: "Company Email" },
    { field: "document.number", label: "Document Number" },
    { field: "document.date", label: "Document Date" },
  ];

  const customerFields = [
    { field: "customer.name", label: "Customer Name" },
    { field: "customer.address", label: "Customer Address" },
    { field: "customer.phone", label: "Customer Phone" },
    { field: "customer.email", label: "Customer Email" },
  ];

  switch (documentType) {
    case "quote":
      return [
        ...commonFields,
        ...customerFields,
        { field: "quote.valid_until", label: "Valid Until" },
        { field: "quote.subtotal", label: "Subtotal" },
        { field: "quote.tax", label: "Tax" },
        { field: "quote.total", label: "Total" },
      ];
    case "invoice":
      return [
        ...commonFields,
        ...customerFields,
        { field: "invoice.due_date", label: "Due Date" },
        { field: "invoice.subtotal", label: "Subtotal" },
        { field: "invoice.tax", label: "Tax" },
        { field: "invoice.total", label: "Total" },
      ];
    case "purchase_order":
      return [
        ...commonFields,
        { field: "supplier.name", label: "Supplier Name" },
        { field: "supplier.address", label: "Supplier Address" },
        { field: "po.delivery_date", label: "Delivery Date" },
        { field: "po.total", label: "Total" },
      ];
    case "field_report":
      return [
        ...commonFields,
        { field: "report.site", label: "Site" },
        { field: "report.technician", label: "Technician" },
        { field: "report.findings", label: "Findings" },
      ];
    default:
      return commonFields;
  }
};
