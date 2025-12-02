import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface PDFDocumentProps {
  templateImage: string; // base64 PNG
  data: {
    documentNumber: string;
    documentDate: string;
    customerName: string;
    customerAddress?: string;
    lineItems: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
    termsConditions?: string;
  };
  documentType: "quote" | "invoice" | "purchase_order" | "field_report";
}

// Styles for crisp text rendering on top of Fabric.js background
const styles = StyleSheet.create({
  page: {
    position: "relative",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  contentLayer: {
    marginTop: 280, // Below header area where logo/company details are
    marginHorizontal: 50,
    marginBottom: 100,
  },
  table: {
    display: "flex",
    width: "100%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    minHeight: 30,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
  },
  colDescription: {
    width: "45%",
    padding: 8,
    fontSize: 10,
  },
  colQuantity: {
    width: "15%",
    padding: 8,
    fontSize: 10,
    textAlign: "right",
  },
  colPrice: {
    width: "20%",
    padding: 8,
    fontSize: 10,
    textAlign: "right",
  },
  colTotal: {
    width: "20%",
    padding: 8,
    fontSize: 10,
    textAlign: "right",
  },
  totalsSection: {
    marginTop: 20,
    marginLeft: "auto",
    width: "40%",
    fontSize: 10,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    paddingVertical: 3,
  },
  grandTotal: {
    fontWeight: "bold",
    fontSize: 12,
    borderTopWidth: 2,
    borderTopColor: "#000",
    paddingTop: 8,
    marginTop: 8,
  },
  notesSection: {
    marginTop: 30,
    fontSize: 9,
    lineHeight: 1.4,
  },
  notesTitle: {
    fontWeight: "bold",
    marginBottom: 5,
    fontSize: 10,
  },
});

export const PDFDocument = ({ templateImage, data, documentType }: PDFDocumentProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Background Layer - High-resolution Fabric.js design */}
      <Image src={templateImage} style={styles.backgroundImage} />
      
      {/* Content Layer - Crisp, selectable text and tables */}
      <View style={styles.contentLayer}>
        {/* Line Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQuantity}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          
          {/* Table Rows - Auto-pagination handled by @react-pdf */}
          {data.lineItems.map((item, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQuantity}>{item.quantity}</Text>
              <Text style={styles.colPrice}>${item.unit_price.toFixed(2)}</Text>
              <Text style={styles.colTotal}>${item.line_total.toFixed(2)}</Text>
            </View>
          ))}
        </View>
        
        {/* Totals Section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text>Subtotal:</Text>
            <Text>${data.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Tax (GST):</Text>
            <Text>${data.tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalsRow, styles.grandTotal]}>
            <Text>Total:</Text>
            <Text>${data.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes Section */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        {/* Terms & Conditions */}
        {data.termsConditions && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Terms & Conditions:</Text>
            <Text>{data.termsConditions}</Text>
          </View>
        )}
      </View>
    </Page>
  </Document>
);
