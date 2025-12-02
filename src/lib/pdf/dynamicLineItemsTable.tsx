// Dynamic Line Items Table Generator for PDF

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { LineItem, LineItemsConfig } from "./types";
import { formatCurrency } from "./dataFieldMapper";

interface DynamicLineItemsTableProps {
  lineItems: LineItem[];
  config: LineItemsConfig;
}

// Column header labels
const columnLabels: Record<string, string> = {
  description: "Description",
  quantity: "Qty",
  unit_price: "Unit Price",
  line_total: "Total",
  cost_price: "Cost",
  margin: "Margin",
};

// Create styles dynamically based on config
const createStyles = (config: LineItemsConfig) =>
  StyleSheet.create({
    table: {
      width: "100%",
      marginVertical: 10,
    },
    headerRow: {
      flexDirection: "row",
      backgroundColor: config.header_style.background || "#f3f4f6",
      borderBottomWidth: 1,
      borderBottomColor: "#d1d5db",
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: config.row_style.border_bottom ? 1 : 0,
      borderBottomColor: "#e5e7eb",
      paddingVertical: 6,
      paddingHorizontal: 4,
      minHeight: 24,
    },
    alternateRow: {
      backgroundColor: config.row_style.alternate_background || "#f9fafb",
    },
    subItemRow: {
      flexDirection: "row",
      borderBottomWidth: config.row_style.border_bottom ? 1 : 0,
      borderBottomColor: "#e5e7eb",
      paddingVertical: 4,
      paddingHorizontal: 4,
      paddingLeft: config.sub_item_indent || 20,
      backgroundColor: "#fafafa",
      minHeight: 20,
    },
    headerText: {
      fontSize: config.header_style.font_size || 9,
      fontWeight: "bold",
      color: config.header_style.text_color || "#374151",
    },
    cellText: {
      fontSize: config.row_style.font_size || 9,
      color: "#374151",
    },
    subItemText: {
      fontSize: (config.row_style.font_size || 9) - 1,
      color: "#6b7280",
      fontStyle: "italic",
    },
    descriptionCell: {
      flex: 1,
      paddingRight: 8,
    },
    numberCell: {
      textAlign: "right",
      paddingHorizontal: 4,
    },
  });

// Calculate column widths
const getColumnWidth = (column: string, config: LineItemsConfig): string => {
  const widths = config.column_widths || {};
  const width = widths[column];
  if (width) return `${width}%`;
  
  // Default widths
  const defaults: Record<string, string> = {
    description: "50%",
    quantity: "12%",
    unit_price: "19%",
    line_total: "19%",
    cost_price: "15%",
    margin: "10%",
  };
  return defaults[column] || "15%";
};

// Render a cell value based on column type
const renderCellValue = (item: LineItem, column: string): string => {
  switch (column) {
    case "description":
      return item.description || "";
    case "quantity":
      return item.quantity?.toString() || "0";
    case "unit_price":
      return formatCurrency(item.unit_price || 0);
    case "line_total":
      return formatCurrency(item.line_total || 0);
    case "cost_price":
      return formatCurrency((item as any).cost_price || 0);
    case "margin":
      return `${((item as any).margin_percentage || 0).toFixed(1)}%`;
    default:
      return "";
  }
};

// Flatten line items with sub-items
const flattenLineItems = (
  lineItems: LineItem[],
  showSubItems: boolean
): Array<{ item: LineItem; isSubItem: boolean; depth: number }> => {
  const result: Array<{ item: LineItem; isSubItem: boolean; depth: number }> = [];
  
  // Separate parent items and sub-items
  const parentItems = lineItems.filter((item) => !item.parent_line_item_id);
  const subItemsMap = new Map<string, LineItem[]>();
  
  if (showSubItems) {
    lineItems
      .filter((item) => item.parent_line_item_id)
      .forEach((subItem) => {
        const parentId = subItem.parent_line_item_id!;
        if (!subItemsMap.has(parentId)) {
          subItemsMap.set(parentId, []);
        }
        subItemsMap.get(parentId)!.push(subItem);
      });
  }
  
  // Build flattened list
  parentItems.forEach((item) => {
    result.push({ item, isSubItem: false, depth: 0 });
    
    if (showSubItems) {
      const subItems = subItemsMap.get(item.id) || item.sub_items || [];
      subItems.forEach((subItem) => {
        result.push({ item: subItem, isSubItem: true, depth: 1 });
      });
    }
  });
  
  return result;
};

export const DynamicLineItemsTable: React.FC<DynamicLineItemsTableProps> = ({
  lineItems,
  config,
}) => {
  const styles = createStyles(config);
  const columns = config.columns || ["description", "quantity", "unit_price", "line_total"];
  const flattenedItems = flattenLineItems(lineItems, config.show_sub_items);
  
  return (
    <View style={styles.table}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {columns.map((column) => (
          <View
            key={column}
            style={[
              column === "description" ? styles.descriptionCell : styles.numberCell,
              { width: getColumnWidth(column, config) },
            ]}
          >
            <Text style={styles.headerText}>{columnLabels[column] || column}</Text>
          </View>
        ))}
      </View>
      
      {/* Data Rows */}
      {flattenedItems.map(({ item, isSubItem }, index) => (
        <View
          key={item.id || index}
          style={[
            isSubItem ? styles.subItemRow : styles.row,
            !isSubItem && index % 2 === 1 && config.row_style.alternate_background
              ? styles.alternateRow
              : {},
          ]}
        >
          {columns.map((column) => (
            <View
              key={column}
              style={[
                column === "description" ? styles.descriptionCell : styles.numberCell,
                { width: getColumnWidth(column, config) },
              ]}
            >
              <Text style={isSubItem ? styles.subItemText : styles.cellText}>
                {renderCellValue(item, column)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

export default DynamicLineItemsTable;
