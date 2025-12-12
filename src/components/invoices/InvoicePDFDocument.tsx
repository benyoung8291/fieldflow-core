import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { DynamicLineItemsTable } from "@/lib/pdf/dynamicLineItemsTable";
import { formatCurrency } from "@/lib/pdf/dataFieldMapper";
import type {
  DocumentData,
  CompanySettings,
  LineItem,
  UnifiedTemplate,
  PageSettings,
} from "@/lib/pdf/types";

// Create dynamic styles based on page settings
const createStyles = (pageSettings: PageSettings) =>
  StyleSheet.create({
    page: {
      flexDirection: "column",
      backgroundColor: "#ffffff",
      paddingTop: pageSettings.margins.top,
      paddingRight: pageSettings.margins.right,
      paddingBottom: 60,
      paddingLeft: pageSettings.margins.left,
      fontFamily: "Helvetica",
      fontSize: 9,
    },
    // Header section
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 15,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#d1d5db",
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      width: 180,
    },
    logo: {
      width: 100,
      height: 50,
      objectFit: "contain",
      marginBottom: 6,
    },
    companyName: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 3,
    },
    companyInfo: {
      fontSize: 8,
      color: "#4b5563",
      lineHeight: 1.4,
    },
    // Document info rows (right side of header)
    docInfoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 3,
    },
    docInfoLabel: {
      fontSize: 9,
      color: "#4b5563",
    },
    docInfoValue: {
      fontSize: 9,
      color: "#1f2937",
      fontWeight: "bold",
    },
    // Bill To / Ship To section
    addressSection: {
      flexDirection: "row",
      marginBottom: 15,
      gap: 20,
    },
    addressColumn: {
      flex: 1,
    },
    addressLabel: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 4,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
    },
    addressName: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 2,
    },
    addressTradingAs: {
      fontSize: 8,
      color: "#6b7280",
      marginBottom: 2,
    },
    addressText: {
      fontSize: 9,
      color: "#374151",
      lineHeight: 1.4,
    },
    addressAbn: {
      fontSize: 8,
      color: "#6b7280",
      marginTop: 2,
    },
    // Invoice description header
    invoiceDescriptionSection: {
      backgroundColor: "#f3f4f6",
      padding: 8,
      marginBottom: 10,
      borderRadius: 2,
    },
    invoiceDescription: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#1f2937",
    },
    // Line items section
    lineItemsSection: {
      marginBottom: 15,
    },
    // Bottom section with payment left and totals right
    bottomSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    // Payment details (left side)
    paymentSection: {
      width: "45%",
      padding: 10,
      backgroundColor: "#f9fafb",
      borderRadius: 3,
      borderWidth: 1,
      borderColor: "#e5e7eb",
    },
    paymentTitle: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
    },
    paymentRow: {
      flexDirection: "row",
      marginBottom: 3,
    },
    paymentLabel: {
      fontSize: 9,
      color: "#4b5563",
      width: 80,
    },
    paymentValue: {
      fontSize: 9,
      color: "#1f2937",
      fontWeight: "bold",
      flex: 1,
    },
    // Totals section (right side)
    totalsSection: {
      width: "40%",
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    totalsRowAlt: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: "#f9fafb",
    },
    totalsLabel: {
      fontSize: 9,
      color: "#4b5563",
    },
    totalsValue: {
      fontSize: 9,
      color: "#1f2937",
      fontWeight: "bold",
    },
    totalsFinal: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: "#1f2937",
      marginTop: 2,
    },
    totalsFinalLabel: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#ffffff",
    },
    totalsFinalValue: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#ffffff",
    },
    balanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: "#fef3c7",
      borderWidth: 1,
      borderColor: "#f59e0b",
      marginTop: 2,
    },
    balanceLabel: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#92400e",
    },
    balanceValue: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#92400e",
    },
    // Reference section
    referenceSection: {
      marginTop: 15,
      padding: 8,
      backgroundColor: "#f9fafb",
      borderRadius: 3,
    },
    referenceTitle: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 4,
    },
    referenceRow: {
      flexDirection: "row",
      marginBottom: 2,
    },
    referenceLabel: {
      fontSize: 8,
      color: "#6b7280",
      width: 100,
    },
    referenceValue: {
      fontSize: 8,
      color: "#374151",
      fontWeight: "bold",
    },
    // Notes section
    notesSection: {
      marginTop: 15,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
    },
    notesTitle: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#374151",
      marginBottom: 4,
    },
    notesText: {
      fontSize: 8,
      color: "#6b7280",
      lineHeight: 1.4,
    },
    // Footer
    footer: {
      position: "absolute",
      bottom: 20,
      left: 40,
      right: 40,
      borderTopWidth: 1,
      borderTopColor: "#e5e7eb",
      paddingTop: 8,
    },
    footerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerRemittance: {
      fontSize: 8,
      color: "#4b5563",
    },
    footerPageNumber: {
      fontSize: 8,
      color: "#9ca3af",
    },
  });

interface InvoicePDFDocumentProps {
  documentData: DocumentData;
  lineItems: LineItem[];
  companySettings: CompanySettings;
  template: UnifiedTemplate;
}

export function InvoicePDFDocument({ 
  documentData, 
  lineItems, 
  companySettings, 
  template 
}: InvoicePDFDocumentProps) {
  const styles = createStyles(template.page_settings);
  
  const hasSourceReferences = documentData.source_service_order || documentData.source_project;
  const hasBankDetails = companySettings.bank_name || companySettings.bank_bsb || companySettings.bank_account_number;
  
  // Calculate balance
  const amountPaid = documentData.amount_paid || 0;
  const balance = (documentData.total || 0) - amountPaid;
  
  return (
    <Document>
      <Page size={template.page_settings.size} style={styles.page} wrap>
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
                .join(" ")}
              {"\n"}
              {companySettings.phone && `Ph: ${companySettings.phone}`}
              {companySettings.email && `  |  ${companySettings.email}`}
              {companySettings.website && `\n${companySettings.website}`}
              {"\n"}
              {companySettings.abn && `ABN: ${companySettings.abn}`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Invoice Nbr:</Text>
              <Text style={styles.docInfoValue}>{documentData.document_number}</Text>
            </View>
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Date:</Text>
              <Text style={styles.docInfoValue}>{documentData.document_date}</Text>
            </View>
            {documentData.due_date && (
              <View style={styles.docInfoRow}>
                <Text style={styles.docInfoLabel}>Due Date:</Text>
                <Text style={styles.docInfoValue}>{documentData.due_date}</Text>
              </View>
            )}
            <View style={styles.docInfoRow}>
              <Text style={styles.docInfoLabel}>Credit Terms:</Text>
              <Text style={styles.docInfoValue}>{documentData.payment_terms || "Due on Receipt"}</Text>
            </View>
            {documentData.customer_id && (
              <View style={styles.docInfoRow}>
                <Text style={styles.docInfoLabel}>Customer ID:</Text>
                <Text style={styles.docInfoValue}>{documentData.customer_id}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Bill To / Ship To Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressColumn}>
            <Text style={styles.addressLabel}>Bill To:</Text>
            {documentData.customer?.legal_name && documentData.customer.legal_name !== documentData.customer.name ? (
              <>
                <Text style={styles.addressName}>{documentData.customer.legal_name}</Text>
                <Text style={styles.addressTradingAs}>Trading as: {documentData.customer.name}</Text>
              </>
            ) : (
              <Text style={styles.addressName}>{documentData.customer?.name}</Text>
            )}
            {documentData.customer?.contact_name && (
              <Text style={styles.addressText}>Attn: {documentData.customer.contact_name}</Text>
            )}
            <Text style={styles.addressText}>
              {documentData.customer?.address}
              {"\n"}
              {[documentData.customer?.city, documentData.customer?.state, documentData.customer?.postcode]
                .filter(Boolean)
                .join(" ")}
            </Text>
            {documentData.customer?.abn && (
              <Text style={styles.addressAbn}>ABN: {documentData.customer.abn}</Text>
            )}
            {documentData.customer?.phone && (
              <Text style={styles.addressText}>Ph: {documentData.customer.phone}</Text>
            )}
          </View>
          <View style={styles.addressColumn}>
            <Text style={styles.addressLabel}>Ship To:</Text>
            {documentData.ship_to ? (
              <>
                <Text style={styles.addressName}>{documentData.ship_to.name}</Text>
                <Text style={styles.addressText}>
                  {documentData.ship_to.address}
                  {"\n"}
                  {[documentData.ship_to.city, documentData.ship_to.state, documentData.ship_to.postcode]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.addressName}>{documentData.customer?.name}</Text>
                <Text style={styles.addressText}>
                  {documentData.customer?.address}
                  {"\n"}
                  {[documentData.customer?.city, documentData.customer?.state, documentData.customer?.postcode]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              </>
            )}
          </View>
        </View>
        
        {/* Invoice Description Header */}
        {documentData.invoice_description && (
          <View style={styles.invoiceDescriptionSection}>
            <Text style={styles.invoiceDescription}>{documentData.invoice_description}</Text>
          </View>
        )}
        
        {/* Line Items */}
        <View style={styles.lineItemsSection}>
          <DynamicLineItemsTable
            lineItems={lineItems}
            config={template.line_items_config}
          />
        </View>
        
        {/* Bottom Section: Payment Details Left + Totals Right */}
        <View style={styles.bottomSection}>
          {/* Payment Details - Left Side */}
          {hasBankDetails ? (
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle}>Payment Details:</Text>
              {companySettings.bank_account_name && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Account Name:</Text>
                  <Text style={styles.paymentValue}>{companySettings.bank_account_name}</Text>
                </View>
              )}
              {companySettings.bank_name && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Bank:</Text>
                  <Text style={styles.paymentValue}>{companySettings.bank_name}</Text>
                </View>
              )}
              {companySettings.bank_bsb && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>BSB:</Text>
                  <Text style={styles.paymentValue}>{companySettings.bank_bsb}</Text>
                </View>
              )}
              {companySettings.bank_account_number && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Account No:</Text>
                  <Text style={styles.paymentValue}>{companySettings.bank_account_number}</Text>
                </View>
              )}
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Reference:</Text>
                <Text style={styles.paymentValue}>{documentData.document_number}</Text>
              </View>
            </View>
          ) : (
            <View style={{ width: "45%" }} />
          )}
          
          {/* Totals - Right Side */}
          <View style={styles.totalsSection}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Sub Total:</Text>
              <Text style={styles.totalsValue}>{formatCurrency(documentData.subtotal)}</Text>
            </View>
            <View style={styles.totalsRowAlt}>
              <Text style={styles.totalsLabel}>Tax Total:</Text>
              <Text style={styles.totalsValue}>{formatCurrency(documentData.tax_amount)}</Text>
            </View>
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Total (AUD):</Text>
              <Text style={styles.totalsFinalValue}>{formatCurrency(documentData.total)}</Text>
            </View>
            <View style={styles.totalsRowAlt}>
              <Text style={styles.totalsLabel}>Paid:</Text>
              <Text style={styles.totalsValue}>{formatCurrency(amountPaid)}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance:</Text>
              <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
            </View>
          </View>
        </View>
        
        {/* Source Document References */}
        {hasSourceReferences && (
          <View style={styles.referenceSection}>
            <Text style={styles.referenceTitle}>Reference Details</Text>
            {documentData.source_service_order && (
              <>
                <View style={styles.referenceRow}>
                  <Text style={styles.referenceLabel}>Service Order:</Text>
                  <Text style={styles.referenceValue}>{documentData.source_service_order.order_number}</Text>
                </View>
                {documentData.source_service_order.work_order_number && (
                  <View style={styles.referenceRow}>
                    <Text style={styles.referenceLabel}>Work Order #:</Text>
                    <Text style={styles.referenceValue}>{documentData.source_service_order.work_order_number}</Text>
                  </View>
                )}
                {documentData.source_service_order.purchase_order_number && (
                  <View style={styles.referenceRow}>
                    <Text style={styles.referenceLabel}>PO #:</Text>
                    <Text style={styles.referenceValue}>{documentData.source_service_order.purchase_order_number}</Text>
                  </View>
                )}
              </>
            )}
            {documentData.source_project && (
              <View style={styles.referenceRow}>
                <Text style={styles.referenceLabel}>Project:</Text>
                <Text style={styles.referenceValue}>{documentData.source_project.name}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Notes */}
        {documentData.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{documentData.notes}</Text>
          </View>
        )}
        
        {/* Footer with remittance and page numbers */}
        <View style={styles.footer} fixed>
          <View style={styles.footerContent}>
            <Text style={styles.footerRemittance}>
              {companySettings.accounts_email 
                ? `Please send remittance to ${companySettings.accounts_email}` 
                : companySettings.email 
                  ? `Please send remittance to ${companySettings.email}`
                  : `Thank you for your business`}
            </Text>
            <Text style={styles.footerPageNumber} render={({ pageNumber, totalPages }) => (
              `Page: ${pageNumber} of ${totalPages}`
            )} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
