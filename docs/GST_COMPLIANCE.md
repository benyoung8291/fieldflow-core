# GST Compliance Guide

## Overview

The system enforces GST compliance rules to ensure financial data integrity:

1. **Vendors who are NOT GST registered cannot charge GST**
2. **All line items have GST-free toggle capability**
3. **Tax calculations automatically respect GST-free status**

## Database Schema

### Vendor GST Registration

```sql
vendors.gst_registered BOOLEAN DEFAULT false
```

This field is automatically populated from ABN lookup API and indicates whether the vendor can legally charge GST.

### Line Item GST-Free Flag

All line item tables have this field:

```sql
{table}_line_items.is_gst_free BOOLEAN DEFAULT false
```

Tables with this field:
- `purchase_order_line_items`
- `quote_line_items`
- `invoice_line_items`
- `project_line_items`
- `service_order_line_items`
- `change_order_line_items`

## Usage in Code

### Import the utilities

```typescript
import {
  canApplyGST,
  isLineItemGSTFree,
  calculateLineItemGST,
  calculateDocumentTotals,
  getGSTWarning,
  formatGSTStatus
} from '@/lib/gstCompliance';
```

### Check if vendor can charge GST

```typescript
const canCharge = canApplyGST(vendor);
// Returns true only if vendor.gst_registered === true
```

### Calculate totals with GST compliance

```typescript
const totals = calculateDocumentTotals(lineItems, 10, vendor);
// Returns:
// {
//   subtotal: number,
//   taxAmount: number,      // Only calculated on taxable items
//   total: number,
//   gstFreeAmount: number,  // Total of GST-free items
//   taxableAmount: number   // Total of taxable items
// }
```

### Display GST warning

```typescript
const warning = getGSTWarning(vendor);
if (warning) {
  toast.warning(warning);
}
```

## UI Requirements

### Purchase Orders

When creating/editing POs:

1. **Display vendor GST status** prominently at the top
2. **Show warning** if vendor is not GST registered
3. **Auto-mark all line items as GST-free** if vendor is not registered
4. **Disable GST toggle** on line items if vendor is not registered
5. **Calculate tax only on taxable line items**

### Line Item Display

Each line item should show:

```tsx
<div className="flex items-center gap-2">
  <span>{description}</span>
  {lineItem.is_gst_free ? (
    <Badge variant="outline">GST Free</Badge>
  ) : (
    <Badge>Incl. GST</Badge>
  )}
</div>
```

### GST Toggle Control

```tsx
<div className="flex items-center gap-2">
  <Label>GST Free</Label>
  <Switch
    checked={lineItem.is_gst_free}
    onCheckedChange={(checked) => updateLineItem({ is_gst_free: checked })}
    disabled={!canApplyGST(vendor)} // Disabled if vendor not GST registered
  />
</div>
```

## Tax Calculation Examples

### Example 1: GST Registered Vendor

```typescript
// Vendor is GST registered
const vendor = { gst_registered: true, name: "ABC Supplies" };

const lineItems = [
  { description: "Item 1", line_total: 100, is_gst_free: false },
  { description: "Item 2", line_total: 50, is_gst_free: true },
];

const totals = calculateDocumentTotals(lineItems, 10, vendor);
// Result:
// subtotal: 150
// taxableAmount: 100
// gstFreeAmount: 50
// taxAmount: 10 (only on the $100 taxable item)
// total: 160
```

### Example 2: Non-GST Registered Vendor

```typescript
// Vendor is NOT GST registered
const vendor = { gst_registered: false, name: "XYZ Trader" };

const lineItems = [
  { description: "Item 1", line_total: 100, is_gst_free: false }, // Will be treated as GST-free
  { description: "Item 2", line_total: 50, is_gst_free: false },  // Will be treated as GST-free
];

const totals = calculateDocumentTotals(lineItems, 10, vendor);
// Result:
// subtotal: 150
// taxableAmount: 0  // No items are taxable!
// gstFreeAmount: 150 // All items forced to GST-free
// taxAmount: 0  // NO GST can be charged
// total: 150
```

## Validation Rules

### On Save/Submit

Before saving any financial document:

1. ✅ Verify vendor GST registration status
2. ✅ Ensure no GST is charged on GST-free line items
3. ✅ Ensure no GST is charged if vendor is not GST registered
4. ✅ Recalculate all totals using `calculateDocumentTotals()`

### On Vendor Change

When changing vendor on a document:

```typescript
const handleVendorChange = (newVendor: Vendor) => {
  setVendor(newVendor);
  
  // Show warning if not GST registered
  const warning = getGSTWarning(newVendor);
  if (warning) {
    toast.warning(warning);
  }
  
  // Force all line items to GST-free if vendor not registered
  if (!canApplyGST(newVendor)) {
    setLineItems(lineItems.map(item => ({
      ...item,
      is_gst_free: true
    })));
  }
  
  // Recalculate totals
  recalculateTotals();
};
```

## Compliance Checklist

When implementing GST features in any financial document:

- [ ] Fetch vendor GST registration status from database
- [ ] Display GST status badge next to vendor name
- [ ] Show warning toast if vendor is not GST registered
- [ ] Add GST-free toggle to each line item
- [ ] Disable GST toggle if vendor is not GST registered
- [ ] Use `calculateDocumentTotals()` for all tax calculations
- [ ] Display taxable vs GST-free subtotals separately
- [ ] Prevent manual GST application to non-registered vendors
- [ ] Validate on save that GST rules are followed
- [ ] Log GST compliance violations to audit trail

## Testing

Test scenarios to verify:

1. ✅ GST registered vendor can charge GST
2. ✅ Non-GST registered vendor CANNOT charge GST
3. ✅ Line items can be individually marked GST-free
4. ✅ Totals calculate correctly with mixed GST/GST-free items
5. ✅ Vendor change updates all line items appropriately
6. ✅ UI shows appropriate warnings and badges
7. ✅ Database saves `is_gst_free` flag correctly
8. ✅ Reports and exports include GST-free indicators
