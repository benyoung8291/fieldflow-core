import { Canvas as FabricCanvas } from "fabric";
import { format } from "date-fns";

interface DocumentData {
  documentNumber: string;
  documentDate: string;
  customerName: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerPostcode?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAbn?: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  termsConditions?: string;
}

interface CompanySettings {
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  company_phone: string | null;
  company_email: string | null;
  abn: string | null;
}

export async function generateTemplateWithData(
  templateJson: any,
  documentData: DocumentData,
  companySettings: CompanySettings,
  documentType: "quote" | "invoice" | "purchase_order" | "field_report"
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create offscreen canvas
      const canvas = new FabricCanvas(null, {
        width: 2480, // A4 at 300 DPI
        height: 3508,
      });

      // Load template JSON
      canvas.loadFromJSON(templateJson, () => {
        try {
          // Build data mapping
          const dataMap = buildDataMapping(documentData, companySettings, documentType);

          // Iterate through all objects and replace data fields
          canvas.getObjects().forEach((obj: any) => {
            if (obj.customType === "dataField" && obj.fieldName) {
              const value = dataMap[obj.fieldName];
              if (value !== undefined && value !== null) {
                obj.set("text", value);
              }
            }
          });

          canvas.renderAll();

          // Export to high-res PNG
          const dataUrl = canvas.toDataURL({
            format: "png",
            quality: 1,
            multiplier: 1, // Already at high res
          });

          canvas.dispose();
          resolve(dataUrl);
        } catch (error) {
          canvas.dispose();
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function buildDataMapping(
  documentData: DocumentData,
  companySettings: CompanySettings,
  documentType: string
): Record<string, string> {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);

  const companyAddress = [
    companySettings.address_line_1,
    companySettings.address_line_2,
  ]
    .filter(Boolean)
    .join(", ");

  const customerAddress = documentData.customerAddress || "";

  const baseMap: Record<string, string> = {
    // Company fields
    "company.name": companySettings.company_name || "",
    "company.address": companyAddress,
    "company.city": companySettings.city || "",
    "company.state": companySettings.state || "",
    "company.postcode": companySettings.postcode || "",
    "company.phone": companySettings.company_phone || "",
    "company.email": companySettings.company_email || "",
    "company.abn": companySettings.abn || "",

    // Customer fields
    "customer.name": documentData.customerName,
    "customer.address": customerAddress,
    "customer.city": documentData.customerCity || "",
    "customer.state": documentData.customerState || "",
    "customer.postcode": documentData.customerPostcode || "",
    "customer.phone": documentData.customerPhone || "",
    "customer.email": documentData.customerEmail || "",
    "customer.abn": documentData.customerAbn || "",

    // Document fields
    "document.number": documentData.documentNumber,
    "document.date": documentData.documentDate,
  };

  // Add document-type specific fields
  if (documentType === "quote") {
    return {
      ...baseMap,
      "quote.subtotal": formatCurrency(documentData.subtotal),
      "quote.tax": formatCurrency(documentData.tax),
      "quote.total": formatCurrency(documentData.total),
      "quote.notes": documentData.notes || "",
      "quote.terms": documentData.termsConditions || "",
    };
  }

  if (documentType === "invoice") {
    return {
      ...baseMap,
      "invoice.subtotal": formatCurrency(documentData.subtotal),
      "invoice.tax": formatCurrency(documentData.tax),
      "invoice.total": formatCurrency(documentData.total),
      "invoice.notes": documentData.notes || "",
    };
  }

  return baseMap;
}
