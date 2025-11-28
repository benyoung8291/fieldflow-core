import { SerializedNodes } from "@craftjs/core";

export const getDefaultTemplate = (documentType: string): SerializedNodes => {
  switch (documentType) {
    case "quote":
      return getQuoteTemplate();
    case "invoice":
      return getInvoiceTemplate();
    case "purchase_order":
      return getPurchaseOrderTemplate();
    case "field_report":
      return getFieldReportTemplate();
    default:
      return getQuoteTemplate();
  }
};

const getQuoteTemplate = (): SerializedNodes => ({
  ROOT: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "#ffffff",
      padding: 0,
      width: "100%",
      height: "100%",
      gap: 0,
      flexDirection: "column"
    },
    displayName: "Container",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["header", "gradientBanner", "customerInfo", "lineItems", "footer"],
    linkedNodes: {}
  },
  header: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 40,
      width: 500,
      height: 80,
      background: "transparent",
      padding: 0,
      gap: 16,
      flexDirection: "row"
    },
    displayName: "Header",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["logo", "companyInfo"],
    linkedNodes: {}
  },
  logo: {
    type: { resolvedName: "ImageBlock" },
    isCanvas: false,
    props: {
      width: 120,
      height: 80,
      objectFit: "contain"
    },
    displayName: "Logo",
    custom: {},
    parent: "header",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  companyInfo: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 4,
      flexDirection: "column"
    },
    displayName: "Company Info",
    custom: {},
    parent: "header",
    hidden: false,
    nodes: ["companyName", "companyContact"],
    linkedNodes: {}
  },
  companyName: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Your Company Name",
      fontSize: 24,
      fontWeight: 700,
      color: "#1a1a1a"
    },
    displayName: "Company Name",
    custom: {},
    parent: "companyInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  companyContact: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "contact@company.com | (555) 123-4567",
      fontSize: 12,
      color: "#666666"
    },
    displayName: "Contact",
    custom: {},
    parent: "companyInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  gradientBanner: {
    type: { resolvedName: "GradientBackground" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 0,
      y: 140,
      width: 595,
      height: 120,
      gradientFrom: "#667eea",
      gradientTo: "#764ba2",
      gradientDirection: 135,
      padding: 32
    },
    displayName: "Banner",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["bannerTitle", "quoteNumber"],
    linkedNodes: {}
  },
  bannerTitle: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "QUOTATION",
      fontSize: 36,
      fontWeight: 700,
      color: "#ffffff",
      textAlign: "center"
    },
    displayName: "Title",
    custom: {},
    parent: "gradientBanner",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  quoteNumber: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "quote_number",
      label: "Quote #",
      fontSize: 16,
      color: "#ffffff",
      fontWeight: 600
    },
    displayName: "Quote Number",
    custom: {},
    parent: "gradientBanner",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  customerInfo: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 280,
      width: 515,
      height: 140,
      background: "#f8f9fa",
      padding: 20,
      gap: 8,
      flexDirection: "column"
    },
    displayName: "Customer Info",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["billToLabel", "customerName", "customerAddress", "customerPhone"],
    linkedNodes: {}
  },
  billToLabel: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Bill To:",
      fontSize: 14,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Bill To",
    custom: {},
    parent: "customerInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  customerName: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "customer.name",
      label: "Customer Name"
    },
    displayName: "Customer Name",
    custom: {},
    parent: "customerInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  customerAddress: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "customer.address",
      label: "Address"
    },
    displayName: "Address",
    custom: {},
    parent: "customerInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  customerPhone: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "customer.phone",
      label: "Phone"
    },
    displayName: "Phone",
    custom: {},
    parent: "customerInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  lineItems: {
    type: { resolvedName: "LineItemsTable" },
    isCanvas: false,
    props: {
      position: "absolute",
      x: 40,
      y: 440,
      width: 515,
      height: 200
    },
    displayName: "Line Items",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  footer: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 0,
      y: 760,
      width: 595,
      height: 80,
      background: "#1f2937",
      padding: 24,
      gap: 8,
      flexDirection: "column"
    },
    displayName: "Footer",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["termsTitle", "termsText"],
    linkedNodes: {}
  },
  termsTitle: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Terms & Conditions",
      fontSize: 12,
      fontWeight: 600,
      color: "#ffffff"
    },
    displayName: "Terms Title",
    custom: {},
    parent: "footer",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  termsText: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Payment due within 30 days. All work guaranteed.",
      fontSize: 10,
      color: "#d1d5db"
    },
    displayName: "Terms",
    custom: {},
    parent: "footer",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  }
});

const getInvoiceTemplate = (): SerializedNodes => ({
  ROOT: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "#ffffff",
      padding: 0,
      width: "100%",
      height: "100%"
    },
    displayName: "Container",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["invHeader", "invBanner", "invDetails", "invLineItems", "invTotals", "invFooter"],
    linkedNodes: {}
  },
  invHeader: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 40,
      width: 515,
      height: 60,
      background: "transparent",
      padding: 0,
      gap: 16,
      flexDirection: "row"
    },
    displayName: "Header",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["invLogo", "invCompanyInfo"],
    linkedNodes: {}
  },
  invLogo: {
    type: { resolvedName: "ImageBlock" },
    isCanvas: false,
    props: {
      width: 100,
      height: 60,
      objectFit: "contain"
    },
    displayName: "Logo",
    custom: {},
    parent: "invHeader",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invCompanyInfo: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 4
    },
    displayName: "Company Info",
    custom: {},
    parent: "invHeader",
    hidden: false,
    nodes: ["invCompanyName", "invCompanyDetails"],
    linkedNodes: {}
  },
  invCompanyName: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Your Business",
      fontSize: 20,
      fontWeight: 700,
      color: "#1a1a1a"
    },
    displayName: "Name",
    custom: {},
    parent: "invCompanyInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invCompanyDetails: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "ABN: 12 345 678 901 | info@business.com",
      fontSize: 11,
      color: "#666666"
    },
    displayName: "Details",
    custom: {},
    parent: "invCompanyInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invBanner: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 120,
      width: 515,
      height: 80,
      background: "#2563eb",
      padding: 20,
      gap: 4
    },
    displayName: "Banner",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["invTitle", "invNumber"],
    linkedNodes: {}
  },
  invTitle: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "INVOICE",
      fontSize: 32,
      fontWeight: 700,
      color: "#ffffff"
    },
    displayName: "Title",
    custom: {},
    parent: "invBanner",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invNumber: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "invoice_number",
      label: "Invoice #",
      fontSize: 14,
      color: "#ffffff"
    },
    displayName: "Number",
    custom: {},
    parent: "invBanner",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invDetails: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 220,
      width: 515,
      height: 120,
      background: "#f8f9fa",
      padding: 16,
      gap: 12,
      flexDirection: "row"
    },
    displayName: "Details",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["invBillTo", "invDates"],
    linkedNodes: {}
  },
  invBillTo: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 6
    },
    displayName: "Bill To",
    custom: {},
    parent: "invDetails",
    hidden: false,
    nodes: ["invBillLabel", "invCustomer", "invAddress"],
    linkedNodes: {}
  },
  invBillLabel: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Bill To:",
      fontSize: 12,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Label",
    custom: {},
    parent: "invBillTo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invCustomer: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "customer.name",
      label: "Customer"
    },
    displayName: "Customer",
    custom: {},
    parent: "invBillTo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invAddress: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "customer.address",
      label: "Address"
    },
    displayName: "Address",
    custom: {},
    parent: "invBillTo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invDates: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 6
    },
    displayName: "Dates",
    custom: {},
    parent: "invDetails",
    hidden: false,
    nodes: ["invDateLabel", "invDate", "invDue"],
    linkedNodes: {}
  },
  invDateLabel: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Invoice Details:",
      fontSize: 12,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Label",
    custom: {},
    parent: "invDates",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invDate: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "invoice_date",
      label: "Date"
    },
    displayName: "Date",
    custom: {},
    parent: "invDates",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invDue: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "due_date",
      label: "Due Date"
    },
    displayName: "Due",
    custom: {},
    parent: "invDates",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invLineItems: {
    type: { resolvedName: "LineItemsTable" },
    isCanvas: false,
    props: {
      position: "absolute",
      x: 40,
      y: 360,
      width: 515,
      height: 240
    },
    displayName: "Items",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invTotals: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 340,
      y: 620,
      width: 215,
      height: 100,
      background: "#f8f9fa",
      padding: 16,
      gap: 8
    },
    displayName: "Totals",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["invSubtotal", "invTax", "invTotal"],
    linkedNodes: {}
  },
  invSubtotal: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "subtotal",
      label: "Subtotal",
      fontSize: 14
    },
    displayName: "Subtotal",
    custom: {},
    parent: "invTotals",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invTax: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "tax",
      label: "GST",
      fontSize: 14
    },
    displayName: "Tax",
    custom: {},
    parent: "invTotals",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invTotal: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "total",
      label: "Total",
      fontSize: 16,
      fontWeight: 700
    },
    displayName: "Total",
    custom: {},
    parent: "invTotals",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invFooter: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 740,
      width: 515,
      height: 60,
      background: "#f3f4f6",
      padding: 16,
      gap: 4
    },
    displayName: "Footer",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["invFooterText", "invPayment"],
    linkedNodes: {}
  },
  invFooterText: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Payment Terms: Net 30 days",
      fontSize: 11,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Terms",
    custom: {},
    parent: "invFooter",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  invPayment: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Please make payment to the account details provided separately.",
      fontSize: 10,
      color: "#666666"
    },
    displayName: "Payment",
    custom: {},
    parent: "invFooter",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  }
});

const getPurchaseOrderTemplate = (): SerializedNodes => ({
  ROOT: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "#ffffff",
      padding: 0,
      width: "100%",
      height: "100%"
    },
    displayName: "Container",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["poHeader", "poTitle", "poInfo", "poItems", "poFooter"],
    linkedNodes: {}
  },
  poHeader: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 40,
      width: 515,
      height: 70,
      background: "transparent",
      padding: 0,
      gap: 16,
      flexDirection: "row"
    },
    displayName: "Header",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["poLogo", "poCompany"],
    linkedNodes: {}
  },
  poLogo: {
    type: { resolvedName: "ImageBlock" },
    isCanvas: false,
    props: {
      width: 110,
      height: 70,
      objectFit: "contain"
    },
    displayName: "Logo",
    custom: {},
    parent: "poHeader",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poCompany: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 4
    },
    displayName: "Company",
    custom: {},
    parent: "poHeader",
    hidden: false,
    nodes: ["poCompanyName", "poCompanyInfo"],
    linkedNodes: {}
  },
  poCompanyName: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Your Company",
      fontSize: 22,
      fontWeight: 700,
      color: "#1a1a1a"
    },
    displayName: "Name",
    custom: {},
    parent: "poCompany",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poCompanyInfo: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "123 Business St | procurement@company.com",
      fontSize: 11,
      color: "#666666"
    },
    displayName: "Info",
    custom: {},
    parent: "poCompany",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poTitle: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 130,
      width: 515,
      height: 70,
      background: "#059669",
      padding: 16,
      gap: 4
    },
    displayName: "Title",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["poTitleText", "poNumber"],
    linkedNodes: {}
  },
  poTitleText: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "PURCHASE ORDER",
      fontSize: 28,
      fontWeight: 700,
      color: "#ffffff"
    },
    displayName: "Title",
    custom: {},
    parent: "poTitle",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poNumber: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "po_number",
      label: "PO #",
      fontSize: 14,
      color: "#ffffff"
    },
    displayName: "Number",
    custom: {},
    parent: "poTitle",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poInfo: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 220,
      width: 515,
      height: 140,
      background: "#f8f9fa",
      padding: 16,
      gap: 12,
      flexDirection: "row"
    },
    displayName: "Info",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["poSupplier", "poDetails"],
    linkedNodes: {}
  },
  poSupplier: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 6
    },
    displayName: "Supplier",
    custom: {},
    parent: "poInfo",
    hidden: false,
    nodes: ["poSupplierLabel", "poSupplierName", "poSupplierAddress"],
    linkedNodes: {}
  },
  poSupplierLabel: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Supplier:",
      fontSize: 12,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Label",
    custom: {},
    parent: "poSupplier",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poSupplierName: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "supplier.name",
      label: "Name"
    },
    displayName: "Name",
    custom: {},
    parent: "poSupplier",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poSupplierAddress: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "supplier.address",
      label: "Address"
    },
    displayName: "Address",
    custom: {},
    parent: "poSupplier",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poDetails: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 6
    },
    displayName: "Details",
    custom: {},
    parent: "poInfo",
    hidden: false,
    nodes: ["poDetailsLabel", "poDate", "poDelivery"],
    linkedNodes: {}
  },
  poDetailsLabel: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Order Details:",
      fontSize: 12,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Label",
    custom: {},
    parent: "poDetails",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poDate: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "order_date",
      label: "Order Date"
    },
    displayName: "Date",
    custom: {},
    parent: "poDetails",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poDelivery: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "delivery_date",
      label: "Delivery Date"
    },
    displayName: "Delivery",
    custom: {},
    parent: "poDetails",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poItems: {
    type: { resolvedName: "LineItemsTable" },
    isCanvas: false,
    props: {
      position: "absolute",
      x: 40,
      y: 380,
      width: 515,
      height: 280
    },
    displayName: "Items",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poFooter: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 680,
      width: 515,
      height: 80,
      background: "#f3f4f6",
      padding: 16,
      gap: 6
    },
    displayName: "Footer",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["poAuthorization", "poNotes"],
    linkedNodes: {}
  },
  poAuthorization: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Authorized by: Purchasing Department",
      fontSize: 11,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Auth",
    custom: {},
    parent: "poFooter",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  poNotes: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Please deliver to the address specified above. Contact us if you have any questions.",
      fontSize: 10,
      color: "#666666"
    },
    displayName: "Notes",
    custom: {},
    parent: "poFooter",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  }
});

const getFieldReportTemplate = (): SerializedNodes => ({
  ROOT: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "#ffffff",
      padding: 0,
      width: "100%",
      height: "100%"
    },
    displayName: "Container",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["frHeader", "frTitle", "frInfo", "frObservations", "frFooter"],
    linkedNodes: {}
  },
  frHeader: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 40,
      width: 515,
      height: 60,
      background: "transparent",
      padding: 0,
      gap: 16,
      flexDirection: "row"
    },
    displayName: "Header",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["frLogo", "frCompany"],
    linkedNodes: {}
  },
  frLogo: {
    type: { resolvedName: "ImageBlock" },
    isCanvas: false,
    props: {
      width: 100,
      height: 60,
      objectFit: "contain"
    },
    displayName: "Logo",
    custom: {},
    parent: "frHeader",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frCompany: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      background: "transparent",
      padding: 0,
      gap: 4
    },
    displayName: "Company",
    custom: {},
    parent: "frHeader",
    hidden: false,
    nodes: ["frCompanyName", "frCompanyInfo"],
    linkedNodes: {}
  },
  frCompanyName: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Field Services",
      fontSize: 20,
      fontWeight: 700,
      color: "#1a1a1a"
    },
    displayName: "Name",
    custom: {},
    parent: "frCompany",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frCompanyInfo: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Professional Field Reports",
      fontSize: 11,
      color: "#666666"
    },
    displayName: "Info",
    custom: {},
    parent: "frCompany",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frTitle: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 120,
      width: 515,
      height: 70,
      background: "#dc2626",
      padding: 16,
      gap: 4
    },
    displayName: "Title",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["frTitleText", "frReportNumber"],
    linkedNodes: {}
  },
  frTitleText: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "FIELD REPORT",
      fontSize: 28,
      fontWeight: 700,
      color: "#ffffff"
    },
    displayName: "Title",
    custom: {},
    parent: "frTitle",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frReportNumber: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "report_number",
      label: "Report #",
      fontSize: 14,
      color: "#ffffff"
    },
    displayName: "Number",
    custom: {},
    parent: "frTitle",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frInfo: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 210,
      width: 515,
      height: 160,
      background: "#f8f9fa",
      padding: 16,
      gap: 12
    },
    displayName: "Info",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["frSite", "frInspector", "frDate", "frLocation"],
    linkedNodes: {}
  },
  frSite: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "site.name",
      label: "Site Name",
      fontSize: 13,
      fontWeight: 600
    },
    displayName: "Site",
    custom: {},
    parent: "frInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frInspector: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "inspector.name",
      label: "Inspector"
    },
    displayName: "Inspector",
    custom: {},
    parent: "frInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frDate: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "inspection_date",
      label: "Date"
    },
    displayName: "Date",
    custom: {},
    parent: "frInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frLocation: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "site.location",
      label: "Location"
    },
    displayName: "Location",
    custom: {},
    parent: "frInfo",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frObservations: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 390,
      width: 515,
      height: 300,
      background: "#ffffff",
      padding: 16,
      gap: 12
    },
    displayName: "Observations",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["frObsTitle", "frObsContent", "frPhotos"],
    linkedNodes: {}
  },
  frObsTitle: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Observations & Findings:",
      fontSize: 14,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Title",
    custom: {},
    parent: "frObservations",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frObsContent: {
    type: { resolvedName: "DataField" },
    isCanvas: false,
    props: {
      field: "observations",
      label: "Details"
    },
    displayName: "Content",
    custom: {},
    parent: "frObservations",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frPhotos: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Supporting documentation and photos attached separately.",
      fontSize: 10,
      color: "#666666",
      fontStyle: "italic"
    },
    displayName: "Photos",
    custom: {},
    parent: "frObservations",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frFooter: {
    type: { resolvedName: "Container" },
    isCanvas: true,
    props: {
      position: "absolute",
      x: 40,
      y: 710,
      width: 515,
      height: 70,
      background: "#f3f4f6",
      padding: 16,
      gap: 6
    },
    displayName: "Footer",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["frSignature", "frDisclaimer"],
    linkedNodes: {}
  },
  frSignature: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "Signature: _________________________ Date: __________",
      fontSize: 11,
      fontWeight: 600,
      color: "#1a1a1a"
    },
    displayName: "Signature",
    custom: {},
    parent: "frFooter",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  },
  frDisclaimer: {
    type: { resolvedName: "RichTextBlock" },
    isCanvas: false,
    props: {
      text: "This report is confidential and intended for authorized personnel only.",
      fontSize: 9,
      color: "#666666"
    },
    displayName: "Disclaimer",
    custom: {},
    parent: "frFooter",
    hidden: false,
    nodes: [],
    linkedNodes: {}
  }
});
