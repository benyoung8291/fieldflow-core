// Unified PDF Generator - Core Engine

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { DynamicLineItemsTable } from "./dynamicLineItemsTable";
import { buildDataMapping, replacePlaceholders, formatCurrency } from "./dataFieldMapper";
import type {
  UnifiedPDFConfig,
  DocumentData,
  CompanySettings,
  LineItem,
  UnifiedTemplate,
  PageSettings,
} from "./types";

// Page dimensions in points (1 point = 1/72 inch)
const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
};

// Create dynamic styles based on page settings
const createStyles = (pageSettings: PageSettings) =>
  StyleSheet.create({
    page: {
      flexDirection: "column",
      backgroundColor: "#ffffff",
      paddingTop: pageSettings.margins.top,
      paddingRight: pageSettings.margins.right,
      paddingBottom: pageSettings.margins.bottom,
      paddingLeft: pageSettings.margins.left,
      fontFamily: "Helvetica",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
      paddingBottom: 15,
      borderBottomWidth: 2,
      borderBottomColor: "#3b82f6",
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      alignItems: "flex-end",
    },
    logo: {
      width: 120,
      height: 60,
      objectFit: "contain",
      marginBottom: 8,
    },
    companyName: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 4,
    },
    companyInfo: {
      fontSize: 9,
      color: "#6b7280",
      lineHeight: 1.4,
    },
    documentTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 8,
    },
    documentNumber: {
      fontSize: 11,
      color: "#6b7280",
      marginBottom: 4,
    },
    documentDate: {
      fontSize: 10,
      color: "#6b7280",
    },
    infoSection: {
      flexDirection: "row",
      marginBottom: 20,
      gap: 30,
    },
    infoColumn: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#9ca3af",
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 10,
      color: "#374151",
      lineHeight: 1.5,
    },
    infoValueBold: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 2,
    },
    lineItemsSection: {
      marginBottom: 20,
    },
    totalsSection: {
      alignSelf: "flex-end",
      width: 200,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    totalsLabel: {
      fontSize: 10,
      color: "#6b7280",
    },
    totalsValue: {
      fontSize: 10,
      color: "#374151",
      fontWeight: "bold",
    },
    totalsFinal: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      marginTop: 4,
      borderTopWidth: 2,
      borderTopColor: "#3b82f6",
    },
    totalsFinalLabel: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#1f2937",
    },
    totalsFinalValue: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#1f2937",
    },
    notesSection: {
      marginTop: 20,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
    },
    notesTitle: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#374151",
      marginBottom: 6,
    },
    notesText: {
      fontSize: 9,
      color: "#6b7280",
      lineHeight: 1.5,
    },
    termsSection: {
      marginTop: 15,
    },
    footer: {
      position: "absolute",
      bottom: 30,
      left: 40,
      right: 40,
      textAlign: "center",
      fontSize: 8,
      color: "#9ca3af",
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
      paddingTop: 10,
    },
  });

// Quote Document Component
const QuoteDocument: React.FC<{
  data: DocumentData;
  lineItems: LineItem[];
  companySettings: CompanySettings;
  template: UnifiedTemplate;
}> = ({ data, lineItems, companySettings, template }) => {
  const styles = createStyles(template.page_settings);
  
  return (
    <Document>
      <Page size={template.page_settings.size} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {companySettings.logo_url && (
              <Image src={companySettings.logo_url} style={styles.logo} />
            )}
            <Text style={styles.companyName}>{companySettings.company_name}</Text>
            <Text style={styles.companyInfo}>
              {companySettings.address}
              {"\n"}
              {[companySettings.city, companySettings.state, companySettings.postcode]
                .filter(Boolean)
                .join(", ")}
              {"\n"}
              {companySettings.phone && `Phone: ${companySettings.phone}`}
              {companySettings.email && `  |  ${companySettings.email}`}
              {"\n"}
              {companySettings.abn && `ABN: ${companySettings.abn}`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentTitle}>Quote</Text>
            <Text style={styles.documentNumber}>#{data.document_number}</Text>
            <Text style={styles.documentDate}>Date: {data.document_date}</Text>
            {data.valid_until && (
              <Text style={styles.documentDate}>Valid Until: {data.valid_until}</Text>
            )}
          </View>
        </View>
        
        {/* Customer & Quote Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Bill To</Text>
            <Text style={styles.infoValueBold}>{data.customer?.name}</Text>
            {data.customer?.contact_name && (
              <Text style={styles.infoValue}>Attn: {data.customer.contact_name}</Text>
            )}
            <Text style={styles.infoValue}>
              {data.customer?.address}
              {"\n"}
              {[data.customer?.city, data.customer?.state, data.customer?.postcode]
                .filter(Boolean)
                .join(", ")}
            </Text>
            {data.customer?.email && (
              <Text style={styles.infoValue}>{data.customer.email}</Text>
            )}
          </View>
          {data.location && (
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Service Location</Text>
              <Text style={styles.infoValueBold}>{data.location.name}</Text>
              {data.location.address && (
                <Text style={styles.infoValue}>{data.location.address}</Text>
              )}
            </View>
          )}
          {data.title && (
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Project</Text>
              <Text style={styles.infoValueBold}>{data.title}</Text>
            </View>
          )}
        </View>
        
        {/* Line Items */}
        <View style={styles.lineItemsSection}>
          <DynamicLineItemsTable
            lineItems={lineItems}
            config={template.line_items_config}
          />
        </View>
        
        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          {(data.discount_amount || 0) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>-{formatCurrency(data.discount_amount || 0)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>GST (10%)</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.tax_amount)}</Text>
          </View>
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total (Inc. GST)</Text>
            <Text style={styles.totalsFinalValue}>{formatCurrency(data.total)}</Text>
          </View>
        </View>
        
        {/* Notes & Terms */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}
        {data.terms_conditions && (
          <View style={styles.termsSection}>
            <Text style={styles.notesTitle}>Terms & Conditions</Text>
            <Text style={styles.notesText}>{data.terms_conditions}</Text>
          </View>
        )}
        
        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {companySettings.company_name} | {companySettings.website || companySettings.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Invoice Document Component - Australian Tax Invoice with full details
const InvoiceDocument: React.FC<{
  data: DocumentData;
  lineItems: LineItem[];
  companySettings: CompanySettings;
  template: UnifiedTemplate;
}> = ({ data, lineItems, companySettings, template }) => {
  const styles = createStyles(template.page_settings);
  
  // Additional invoice-specific styles
  const invoiceStyles = StyleSheet.create({
    taxInvoiceTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 4,
    },
    referenceSection: {
      marginBottom: 15,
      padding: 10,
      backgroundColor: "#f9fafb",
      borderRadius: 4,
    },
    referenceRow: {
      flexDirection: "row",
      marginBottom: 4,
    },
    referenceLabel: {
      fontSize: 9,
      color: "#6b7280",
      width: 120,
    },
    referenceValue: {
      fontSize: 9,
      color: "#374151",
      fontWeight: "bold",
    },
    paymentSection: {
      marginTop: 20,
      padding: 12,
      backgroundColor: "#eff6ff",
      borderRadius: 4,
      borderLeftWidth: 4,
      borderLeftColor: "#3b82f6",
    },
    paymentTitle: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 8,
    },
    paymentRow: {
      flexDirection: "row",
      marginBottom: 4,
    },
    paymentLabel: {
      fontSize: 9,
      color: "#6b7280",
      width: 100,
    },
    paymentValue: {
      fontSize: 9,
      color: "#374151",
      fontWeight: "bold",
    },
    paymentInstructions: {
      fontSize: 8,
      color: "#6b7280",
      marginTop: 8,
      fontStyle: "italic",
    },
    customerAbn: {
      fontSize: 9,
      color: "#6b7280",
      marginTop: 2,
    },
  });
  
  const hasSourceReferences = data.source_service_order || data.source_project;
  const hasBankDetails = companySettings.bank_name || companySettings.bank_bsb || companySettings.bank_account_number;
  
  return (
    <Document>
      <Page size={template.page_settings.size} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {companySettings.logo_url && (
              <Image src={companySettings.logo_url} style={styles.logo} />
            )}
            <Text style={styles.companyName}>{companySettings.company_name}</Text>
            <Text style={styles.companyInfo}>
              {companySettings.address}
              {companySettings.address_line_2 && `\n${companySettings.address_line_2}`}
              {"\n"}
              {[companySettings.city, companySettings.state, companySettings.postcode]
                .filter(Boolean)
                .join(", ")}
              {"\n"}
              {companySettings.phone && `Phone: ${companySettings.phone}`}
              {companySettings.email && `  |  ${companySettings.email}`}
              {"\n"}
              {companySettings.abn && `ABN: ${companySettings.abn}`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={invoiceStyles.taxInvoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.documentNumber}>#{data.document_number}</Text>
            <Text style={styles.documentDate}>Date: {data.document_date}</Text>
            {data.due_date && (
              <Text style={styles.documentDate}>Due: {data.due_date}</Text>
            )}
          </View>
        </View>
        
        {/* Customer Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Bill To</Text>
            {/* Show legal name if different from trading name */}
            {data.customer?.legal_name && data.customer.legal_name !== data.customer.name ? (
              <>
                <Text style={styles.infoValueBold}>{data.customer.legal_name}</Text>
                <Text style={styles.infoValue}>Trading as: {data.customer.name}</Text>
              </>
            ) : (
              <Text style={styles.infoValueBold}>{data.customer?.name}</Text>
            )}
            {data.customer?.contact_name && (
              <Text style={styles.infoValue}>Attn: {data.customer.contact_name}</Text>
            )}
            <Text style={styles.infoValue}>
              {data.customer?.address}
              {"\n"}
              {[data.customer?.city, data.customer?.state, data.customer?.postcode]
                .filter(Boolean)
                .join(", ")}
            </Text>
            {data.customer?.abn && (
              <Text style={invoiceStyles.customerAbn}>ABN: {data.customer.abn}</Text>
            )}
            {data.customer?.billing_email && (
              <Text style={styles.infoValue}>{data.customer.billing_email}</Text>
            )}
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Payment Terms</Text>
            <Text style={styles.infoValueBold}>{data.payment_terms || "Due on Receipt"}</Text>
            {data.due_date && (
              <>
                <Text style={styles.infoLabel}>Amount Due</Text>
                <Text style={styles.infoValueBold}>{formatCurrency(data.total)}</Text>
              </>
            )}
          </View>
        </View>
        
        {/* Source Document References */}
        {hasSourceReferences && (
          <View style={invoiceStyles.referenceSection}>
            <Text style={styles.infoLabel}>Reference Details</Text>
            {data.source_service_order && (
              <>
                <View style={invoiceStyles.referenceRow}>
                  <Text style={invoiceStyles.referenceLabel}>Service Order:</Text>
                  <Text style={invoiceStyles.referenceValue}>{data.source_service_order.order_number}</Text>
                </View>
                {data.source_service_order.work_order_number && (
                  <View style={invoiceStyles.referenceRow}>
                    <Text style={invoiceStyles.referenceLabel}>Work Order #:</Text>
                    <Text style={invoiceStyles.referenceValue}>{data.source_service_order.work_order_number}</Text>
                  </View>
                )}
                {data.source_service_order.purchase_order_number && (
                  <View style={invoiceStyles.referenceRow}>
                    <Text style={invoiceStyles.referenceLabel}>Customer PO #:</Text>
                    <Text style={invoiceStyles.referenceValue}>{data.source_service_order.purchase_order_number}</Text>
                  </View>
                )}
              </>
            )}
            {data.source_project && (
              <View style={invoiceStyles.referenceRow}>
                <Text style={invoiceStyles.referenceLabel}>Project:</Text>
                <Text style={invoiceStyles.referenceValue}>{data.source_project.name}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Line Items */}
        <View style={styles.lineItemsSection}>
          <DynamicLineItemsTable
            lineItems={lineItems}
            config={template.line_items_config}
          />
        </View>
        
        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal (Ex. GST)</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>GST (10%)</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.tax_amount)}</Text>
          </View>
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total Due (Inc. GST)</Text>
            <Text style={styles.totalsFinalValue}>{formatCurrency(data.total)}</Text>
          </View>
        </View>
        
        {/* Payment Details */}
        {hasBankDetails && (
          <View style={invoiceStyles.paymentSection}>
            <Text style={invoiceStyles.paymentTitle}>Payment Details</Text>
            {companySettings.bank_name && (
              <View style={invoiceStyles.paymentRow}>
                <Text style={invoiceStyles.paymentLabel}>Bank:</Text>
                <Text style={invoiceStyles.paymentValue}>{companySettings.bank_name}</Text>
              </View>
            )}
            {companySettings.bank_account_name && (
              <View style={invoiceStyles.paymentRow}>
                <Text style={invoiceStyles.paymentLabel}>Account Name:</Text>
                <Text style={invoiceStyles.paymentValue}>{companySettings.bank_account_name}</Text>
              </View>
            )}
            {companySettings.bank_bsb && (
              <View style={invoiceStyles.paymentRow}>
                <Text style={invoiceStyles.paymentLabel}>BSB:</Text>
                <Text style={invoiceStyles.paymentValue}>{companySettings.bank_bsb}</Text>
              </View>
            )}
            {companySettings.bank_account_number && (
              <View style={invoiceStyles.paymentRow}>
                <Text style={invoiceStyles.paymentLabel}>Account No:</Text>
                <Text style={invoiceStyles.paymentValue}>{companySettings.bank_account_number}</Text>
              </View>
            )}
            <View style={invoiceStyles.paymentRow}>
              <Text style={invoiceStyles.paymentLabel}>Reference:</Text>
              <Text style={invoiceStyles.paymentValue}>{data.document_number}</Text>
            </View>
            {companySettings.payment_instructions && (
              <Text style={invoiceStyles.paymentInstructions}>{companySettings.payment_instructions}</Text>
            )}
          </View>
        )}
        
        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}
        
        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {companySettings.company_name} | {companySettings.abn ? `ABN: ${companySettings.abn}` : ""} | {companySettings.website || companySettings.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Purchase Order Document Component
const PurchaseOrderDocument: React.FC<{
  data: DocumentData;
  lineItems: LineItem[];
  companySettings: CompanySettings;
  template: UnifiedTemplate;
}> = ({ data, lineItems, companySettings, template }) => {
  const styles = createStyles(template.page_settings);
  
  return (
    <Document>
      <Page size={template.page_settings.size} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {companySettings.logo_url && (
              <Image src={companySettings.logo_url} style={styles.logo} />
            )}
            <Text style={styles.companyName}>{companySettings.company_name}</Text>
            <Text style={styles.companyInfo}>
              {companySettings.address}
              {"\n"}
              {[companySettings.city, companySettings.state, companySettings.postcode]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentTitle}>Purchase Order</Text>
            <Text style={styles.documentNumber}>#{data.document_number}</Text>
            <Text style={styles.documentDate}>Date: {data.document_date}</Text>
            {data.delivery_date && (
              <Text style={styles.documentDate}>Delivery: {data.delivery_date}</Text>
            )}
          </View>
        </View>
        
        {/* Supplier Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Supplier</Text>
            <Text style={styles.infoValueBold}>{data.supplier?.name}</Text>
            <Text style={styles.infoValue}>
              {data.supplier?.address}
              {"\n"}
              {[data.supplier?.city, data.supplier?.state, data.supplier?.postcode]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>
          {data.shipping_address && (
            <View style={styles.infoColumn}>
              <Text style={styles.infoLabel}>Ship To</Text>
              <Text style={styles.infoValue}>{data.shipping_address}</Text>
            </View>
          )}
        </View>
        
        {/* Line Items */}
        <View style={styles.lineItemsSection}>
          <DynamicLineItemsTable
            lineItems={lineItems}
            config={template.line_items_config}
          />
        </View>
        
        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>GST (10%)</Text>
            <Text style={styles.totalsValue}>{formatCurrency(data.tax_amount)}</Text>
          </View>
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalValue}>{formatCurrency(data.total)}</Text>
          </View>
        </View>
        
        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}
        
        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {companySettings.company_name} | {companySettings.website || companySettings.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Field Report Document Component
const FieldReportDocument: React.FC<{
  data: DocumentData;
  lineItems: LineItem[];
  companySettings: CompanySettings;
  template: UnifiedTemplate;
}> = ({ data, lineItems, companySettings, template }) => {
  const styles = createStyles(template.page_settings);
  
  return (
    <Document>
      <Page size={template.page_settings.size} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {companySettings.logo_url && (
              <Image src={companySettings.logo_url} style={styles.logo} />
            )}
            <Text style={styles.companyName}>{companySettings.company_name}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentTitle}>Field Report</Text>
            <Text style={styles.documentNumber}>#{data.document_number}</Text>
            <Text style={styles.documentDate}>Date: {data.document_date}</Text>
          </View>
        </View>
        
        {/* Report Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Site Location</Text>
            <Text style={styles.infoValueBold}>{data.site_location || data.location?.name}</Text>
            {data.location?.address && (
              <Text style={styles.infoValue}>{data.location.address}</Text>
            )}
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Technician</Text>
            <Text style={styles.infoValue}>{data.technician_name}</Text>
            {data.weather_conditions && (
              <>
                <Text style={[styles.infoLabel, { marginTop: 8 }]}>Weather</Text>
                <Text style={styles.infoValue}>{data.weather_conditions}</Text>
              </>
            )}
          </View>
        </View>
        
        {/* Findings */}
        {data.findings && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Findings</Text>
            <Text style={styles.notesText}>{data.findings}</Text>
          </View>
        )}
        
        {/* Work Performed */}
        {data.work_performed && (
          <View style={styles.termsSection}>
            <Text style={styles.notesTitle}>Work Performed</Text>
            <Text style={styles.notesText}>{data.work_performed}</Text>
          </View>
        )}
        
        {/* Recommendations */}
        {data.recommendations && (
          <View style={styles.termsSection}>
            <Text style={styles.notesTitle}>Recommendations</Text>
            <Text style={styles.notesText}>{data.recommendations}</Text>
          </View>
        )}
        
        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {companySettings.company_name} | {companySettings.website || companySettings.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Generate a PDF blob from the unified configuration
 */
export async function generateUnifiedPDF(config: UnifiedPDFConfig): Promise<Blob> {
  const { template, documentData, lineItems, companySettings, documentType } = config;
  
  // Build data mapping for any custom field replacements
  const dataMapping = buildDataMapping(documentData, companySettings, documentType);
  
  // Select the appropriate document component
  let DocumentComponent: React.FC<any>;
  
  switch (documentType) {
    case "quote":
      DocumentComponent = QuoteDocument;
      break;
    case "invoice":
      DocumentComponent = InvoiceDocument;
      break;
    case "purchase_order":
      DocumentComponent = PurchaseOrderDocument;
      break;
    case "field_report":
      DocumentComponent = FieldReportDocument;
      break;
    default:
      DocumentComponent = QuoteDocument;
  }
  
  // Create the document element
  const documentElement = React.createElement(DocumentComponent, {
    data: documentData,
    lineItems,
    companySettings,
    template,
  });
  
  // Generate and return the PDF blob
  const blob = await pdf(documentElement).toBlob();
  return blob;
}

/**
 * Get default template configuration for a document type
 */
export function getDefaultTemplate(documentType: 'quote' | 'invoice' | 'purchase_order' | 'field_report'): UnifiedTemplate {
  return {
    id: 'default',
    name: `Default ${documentType.replace('_', ' ')} Template`,
    document_type: documentType,
    field_mappings: {},
    line_items_config: {
      columns: ['description', 'quantity', 'unit_price', 'line_total'],
      show_sub_items: true,
      column_widths: { description: 50, quantity: 12, unit_price: 19, line_total: 19 },
      header_style: { background: '#f3f4f6', font_weight: 'bold', font_size: 9 },
      row_style: { border_bottom: true, font_size: 9 },
      sub_item_indent: 20,
    },
    content_zones: {
      header: { y: 0, height: 120 },
      document_info: { y: 120, height: 100 },
      line_items: { y: 220, height: 'auto' },
      totals: { y: 'after_line_items', height: 80 },
      footer: { y: 'bottom', height: 100 },
    },
    page_settings: {
      size: 'A4' as const,
      orientation: 'portrait' as const,
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
  };
}

export default generateUnifiedPDF;
