import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { generateUnifiedPDF, getDefaultTemplate } from "@/lib/pdf";
import type { DocumentData, LineItem, CompanySettings, UnifiedTemplate, DocumentType } from "@/lib/pdf/types";
import { format } from "date-fns";

interface InvoicePDFDownloadProps {
  invoiceId: string;
  invoiceNumber: string;
  invoice: any;
  lineItems: any[];
  sourceDocuments?: Map<string, any>;
}

export default function InvoicePDFDownload({ 
  invoiceId, 
  invoiceNumber, 
  invoice, 
  lineItems,
  sourceDocuments 
}: InvoicePDFDownloadProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Fetch company settings with bank details
      const { data: tenantSettings } = await supabase
        .from("tenant_settings" as any)
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      const settings = tenantSettings as any;
      const companySettings: CompanySettings = {
        company_name: settings?.company_name || "",
        company_legal_name: settings?.company_legal_name || "",
        logo_url: settings?.logo_url || undefined,
        address: settings?.address_line_1 || "",
        address_line_2: settings?.address_line_2 || "",
        city: settings?.city || "",
        state: settings?.state || "",
        postcode: settings?.postcode || "",
        phone: settings?.company_phone || "",
        email: settings?.company_email || "",
        website: settings?.company_website || "",
        abn: settings?.abn || "",
        default_tax_rate: settings?.default_tax_rate || 10,
        // Bank details
        bank_name: settings?.bank_name || "",
        bank_bsb: settings?.bank_bsb || "",
        bank_account_number: settings?.bank_account_number || "",
        bank_account_name: settings?.bank_account_name || "",
        payment_instructions: settings?.payment_instructions || "",
        terms_conditions: settings?.invoice_terms_conditions || "",
      };

      // Fetch full customer details if we have a customer_id
      let customerInfo = invoice.customers || {};
      if (invoice.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select(`
            id, name, legal_company_name, trading_name, abn, 
            billing_address, billing_email, billing_phone,
            address, city, state, postcode, email, phone
          `)
          .eq("id", invoice.customer_id)
          .single();
        
        if (customer) {
          customerInfo = customer;
        }

        // Fetch primary billing contact with full address
        const { data: billingContact } = await supabase
          .from("contacts")
          .select("first_name, last_name, email, phone, address, city, state, postcode")
          .eq("customer_id", invoice.customer_id)
          .eq("is_primary", true)
          .maybeSingle();

        if (billingContact) {
          customerInfo.contact_name = `${billingContact.first_name} ${billingContact.last_name}`.trim();
          customerInfo.billing_email = customerInfo.billing_email || billingContact.email;
          customerInfo.billing_phone = customerInfo.billing_phone || billingContact.phone;
          // Billing contact address
          customerInfo.billing_contact_name = `${billingContact.first_name} ${billingContact.last_name}`.trim();
          customerInfo.billing_contact_address = billingContact.address;
          customerInfo.billing_contact_city = billingContact.city;
          customerInfo.billing_contact_state = billingContact.state;
          customerInfo.billing_contact_postcode = billingContact.postcode;
        }
      }

      // Build source document references from line items and collect unique locations
      let sourceServiceOrder = undefined;
      let sourceProject = undefined;
      // Use invoice description if set, otherwise derive from source documents
      let invoiceDescription = invoice.description || '';
      const uniqueLocations: Map<string, any> = new Map();
      const sourceLocationMap = new Map<string, any>();
      
      if (sourceDocuments && sourceDocuments.size > 0) {
        for (const [key, doc] of sourceDocuments) {
          if (doc.type === "service_order") {
            if (!sourceServiceOrder) {
              sourceServiceOrder = {
                order_number: doc.order_number,
                work_order_number: doc.work_order_number,
                purchase_order_number: doc.purchase_order_number,
              };
              // Only use source document description if invoice description is empty
              if (!invoiceDescription && doc.description) {
                invoiceDescription = doc.description;
              }
            }
            // Collect all locations
            if (doc.location?.name) {
              uniqueLocations.set(doc.location.name, doc.location);
              sourceLocationMap.set(doc.id, doc.location);
            }
          } else if (doc.type === "project" && !sourceProject) {
            sourceProject = {
              name: doc.name,
            };
            // Only use source document description if invoice description is empty
            if (!invoiceDescription && doc.name) {
              invoiceDescription = doc.name;
            }
          }
        }
      }

      // Determine Ship To based on unique locations
      let shipTo = undefined;
      if (uniqueLocations.size === 1) {
        const [, location] = [...uniqueLocations.entries()][0];
        shipTo = {
          name: location.name || '',
          address: location.address || '',
          city: location.city || '',
          state: location.state || '',
          postcode: location.postcode || '',
        };
      } else if (uniqueLocations.size > 1) {
        shipTo = {
          name: 'Multiple - as itemised below',
          address: '',
          city: '',
          state: '',
          postcode: '',
        };
      }

      // Build document data
      const documentData: DocumentData = {
        document_number: invoiceNumber,
        document_date: invoice.invoice_date,
        due_date: invoice.due_date || undefined,
        payment_terms: invoice.payment_terms || "Due on Receipt",
        subtotal: invoice.subtotal || 0,
        tax_amount: invoice.tax_amount || 0,
        total: invoice.total_amount || 0,
        amount_paid: invoice.amount_paid || 0,
        notes: invoice.notes,
        customer_id: customerInfo.acumatica_customer_id || customerInfo.id?.substring(0, 8)?.toUpperCase(),
        invoice_description: invoiceDescription,
        ship_to: shipTo,
        customer: {
          name: customerInfo.name || "",
          legal_name: customerInfo.legal_company_name,
          trading_name: customerInfo.trading_name,
          abn: customerInfo.abn,
          contact_name: customerInfo.billing_contact_name || customerInfo.contact_name,
          // Use billing contact address if available, otherwise customer billing address
          address: customerInfo.billing_contact_address || customerInfo.billing_address || customerInfo.address || "",
          city: customerInfo.billing_contact_city || customerInfo.city || "",
          state: customerInfo.billing_contact_state || customerInfo.state || "",
          postcode: customerInfo.billing_contact_postcode || customerInfo.postcode || "",
          email: customerInfo.billing_email || customerInfo.email || "",
          phone: customerInfo.billing_phone || customerInfo.phone || "",
          billing_email: customerInfo.billing_email,
          billing_phone: customerInfo.billing_phone,
        },
        source_service_order: sourceServiceOrder,
        source_project: sourceProject,
      };

      // Convert line items with location names
      const hasMultipleLocations = uniqueLocations.size > 1;
      const pdfLineItems: LineItem[] = (lineItems || []).map((item, index) => {
        // Get location name from source service order
        let locationName = '';
        if (item.source_type === 'service_order' && item.source_id && sourceLocationMap.has(item.source_id)) {
          locationName = sourceLocationMap.get(item.source_id)?.name || '';
        }
        
        // Prepend location name to description if we have multiple locations
        const description = hasMultipleLocations && locationName 
          ? `[${locationName}] ${item.description || ''}`
          : item.description || '';
        
        return {
          id: item.id || `item-${index}`,
          description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          line_total: item.line_total || 0,
          is_gst_free: item.is_gst_free || false,
          location_name: locationName,
        };
      });

      // Fetch template or use default
      const { data: templateData } = await supabase
        .from("pdf_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("document_type", "invoice")
        .eq("is_default", true)
        .maybeSingle();

      const template: UnifiedTemplate = templateData
        ? {
            id: templateData.id,
            name: templateData.name,
            document_type: templateData.document_type as DocumentType,
            field_mappings: (templateData.field_mappings as any) || {},
            line_items_config: (templateData.line_items_config as any) || getDefaultTemplate("invoice").line_items_config,
            content_zones: (templateData.content_zones as any) || getDefaultTemplate("invoice").content_zones,
            page_settings: (templateData.page_settings as any) || getDefaultTemplate("invoice").page_settings,
          }
        : getDefaultTemplate("invoice");

      const blob = await generateUnifiedPDF({
        template,
        documentData,
        lineItems: pdfLineItems,
        companySettings,
        documentType: "invoice",
      });

      const filename = `Invoice-${invoiceNumber}.pdf`;
      saveAs(blob, filename);

      toast.success("Invoice PDF downloaded");
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast.error(error.message || "Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={generating}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {generating ? "Generating..." : "Download PDF"}
    </Button>
  );
}
