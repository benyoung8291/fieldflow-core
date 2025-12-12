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
      fontSize: 28,
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: 4,
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
            <Text style={styles.documentTitle}>TAX INVOICE</Text>
            <Text style={styles.documentNumber}>#{documentData.document_number}</Text>
            <Text style={styles.documentDate}>Date: {documentData.document_date}</Text>
            {documentData.due_date && (
              <Text style={styles.documentDate}>Due: {documentData.due_date}</Text>
            )}
          </View>
        </View>
        
        {/* Customer Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Bill To</Text>
            {documentData.customer?.legal_name && documentData.customer.legal_name !== documentData.customer.name ? (
              <>
                <Text style={styles.infoValueBold}>{documentData.customer.legal_name}</Text>
                <Text style={styles.infoValue}>Trading as: {documentData.customer.name}</Text>
              </>
            ) : (
              <Text style={styles.infoValueBold}>{documentData.customer?.name}</Text>
            )}
            {documentData.customer?.contact_name && (
              <Text style={styles.infoValue}>Attn: {documentData.customer.contact_name}</Text>
            )}
            <Text style={styles.infoValue}>
              {documentData.customer?.address}
              {"\n"}
              {[documentData.customer?.city, documentData.customer?.state, documentData.customer?.postcode]
                .filter(Boolean)
                .join(", ")}
            </Text>
            {documentData.customer?.abn && (
              <Text style={styles.customerAbn}>ABN: {documentData.customer.abn}</Text>
            )}
            {documentData.customer?.billing_email && (
              <Text style={styles.infoValue}>{documentData.customer.billing_email}</Text>
            )}
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Payment Terms</Text>
            <Text style={styles.infoValueBold}>{documentData.payment_terms || "Due on Receipt"}</Text>
            {documentData.due_date && (
              <>
                <Text style={styles.infoLabel}>Amount Due</Text>
                <Text style={styles.infoValueBold}>{formatCurrency(documentData.total)}</Text>
              </>
            )}
          </View>
        </View>
        
        {/* Source Document References */}
        {hasSourceReferences && (
          <View style={styles.referenceSection}>
            <Text style={styles.infoLabel}>Reference Details</Text>
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
                    <Text style={styles.referenceLabel}>Purchase Order #:</Text>
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
            <Text style={styles.totalsValue}>{formatCurrency(documentData.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>GST (10%)</Text>
            <Text style={styles.totalsValue}>{formatCurrency(documentData.tax_amount)}</Text>
          </View>
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total (Inc. GST)</Text>
            <Text style={styles.totalsFinalValue}>{formatCurrency(documentData.total)}</Text>
          </View>
        </View>
        
        {/* Payment Details */}
        {hasBankDetails && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment Details</Text>
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
            {companySettings.bank_account_name && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Account Name:</Text>
                <Text style={styles.paymentValue}>{companySettings.bank_account_name}</Text>
              </View>
            )}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Reference:</Text>
              <Text style={styles.paymentValue}>{documentData.document_number}</Text>
            </View>
            {companySettings.payment_instructions && (
              <Text style={styles.paymentInstructions}>{companySettings.payment_instructions}</Text>
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
        
        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {companySettings.company_name} | {companySettings.website || companySettings.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
