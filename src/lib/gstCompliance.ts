/**
 * GST Compliance Utilities
 * 
 * Ensures financial data integrity around GST:
 * - Vendors who are not GST registered cannot charge GST
 * - Line items can be marked as GST-free
 * - Tax calculations respect GST-free status
 */

export interface LineItemWithGST {
  is_gst_free?: boolean;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
}

export interface Supplier {
  gst_registered?: boolean;
  name?: string;
}

/**
 * Validates if GST can be applied to a line item based on supplier GST registration
 * @param supplier The supplier
 * @returns true if supplier is GST registered and can charge GST
 */
export function canApplyGST(supplier: Supplier | null): boolean {
  return supplier?.gst_registered === true;
}

/**
 * Determines if a line item should be GST-free
 * @param lineItem The line item
 * @param supplier The supplier (for purchase orders)
 * @returns true if the line item should not have GST applied
 */
export function isLineItemGSTFree(lineItem: LineItemWithGST, supplier?: Supplier | null): boolean {
  // If explicitly marked as GST-free, respect that
  if (lineItem.is_gst_free === true) {
    return true;
  }
  
  // For purchase orders: if supplier is not GST registered, line item MUST be GST-free
  if (supplier && !canApplyGST(supplier)) {
    return true;
  }
  
  return false;
}

/**
 * Calculates GST amount for a line item, respecting GST-free status
 * @param lineItem The line item
 * @param taxRate The tax rate (as percentage, e.g., 10 for 10%)
 * @param supplier The supplier (for purchase orders)
 * @returns The GST amount, or 0 if GST-free
 */
export function calculateLineItemGST(
  lineItem: LineItemWithGST,
  taxRate: number,
  supplier?: Supplier | null
): number {
  if (isLineItemGSTFree(lineItem, supplier)) {
    return 0;
  }
  
  const lineTotal = lineItem.line_total || 0;
  return lineTotal * (taxRate / 100);
}

/**
 * Calculates totals for a collection of line items with GST compliance
 * @param lineItems Array of line items
 * @param taxRate The tax rate (as percentage)
 * @param supplier The supplier (for purchase orders)
 * @returns Object with subtotal, taxAmount, and total
 */
export function calculateDocumentTotals(
  lineItems: LineItemWithGST[],
  taxRate: number,
  supplier?: Supplier | null
): {
  subtotal: number;
  taxAmount: number;
  total: number;
  gstFreeAmount: number;
  taxableAmount: number;
} {
  let subtotal = 0;
  let gstFreeAmount = 0;
  let taxableAmount = 0;
  
  lineItems.forEach(item => {
    const lineTotal = item.line_total || 0;
    subtotal += lineTotal;
    
    if (isLineItemGSTFree(item, supplier)) {
      gstFreeAmount += lineTotal;
    } else {
      taxableAmount += lineTotal;
    }
  });
  
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = subtotal + taxAmount;
  
  return {
    subtotal,
    taxAmount,
    total,
    gstFreeAmount,
    taxableAmount,
  };
}

/**
 * Gets a warning message if trying to apply GST to a non-GST registered supplier
 * @param supplier The supplier
 * @returns Warning message or null
 */
export function getGSTWarning(supplier: Supplier | null): string | null {
  if (supplier && !canApplyGST(supplier)) {
    return `${supplier.name || 'This supplier'} is not GST registered and cannot charge GST. All line items will be GST-free.`;
  }
  return null;
}

/**
 * Formats GST status for display
 * @param isGSTFree Whether the line item is GST-free
 * @returns Display string
 */
export function formatGSTStatus(isGSTFree: boolean): string {
  return isGSTFree ? 'GST Free' : 'Incl. GST';
}
