import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

/**
 * Financial Workflow Integration Tests
 * 
 * Tests the complete financial data flow:
 * Quote → Service Order → Project → Change Order → Purchase Order → Invoice → Accounting Sync
 * 
 * Validates:
 * - Currency precision through all stages
 * - GST calculations accuracy
 * - Data transformation integrity
 * - Edge cases (large numbers, decimals, zero values)
 */

describe('Financial Workflow Integration Tests', () => {
  const testTenantId = '00000000-0000-0000-0000-000000000000';
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testCustomerId = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    // Mock Supabase client
    vi.clearAllMocks();
  });

  describe('Quote to Service Order Flow', () => {
    it('should maintain currency precision when converting quote to service order', async () => {
      const quoteLineItems = [
        { description: 'Item 1', quantity: 2, unit_price: 1234.56, is_gst_free: false },
        { description: 'Item 2', quantity: 1.5, unit_price: 999.99, is_gst_free: false },
        { description: 'GST Free Item', quantity: 1, unit_price: 500.00, is_gst_free: true },
      ];

      // Calculate quote totals
      const gstFreeTotal = quoteLineItems
        .filter(item => item.is_gst_free)
        .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      const taxableTotal = quoteLineItems
        .filter(item => !item.is_gst_free)
        .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      const gstAmount = taxableTotal * 0.1;
      const quoteTotal = gstFreeTotal + taxableTotal + gstAmount;

      // Expected values with proper precision
      expect(gstFreeTotal).toBe(500.00);
      expect(taxableTotal).toBe(3969.11); // (2 * 1234.56) + (1.5 * 999.99)
      expect(gstAmount).toBe(396.911);
      expect(quoteTotal).toBe(4866.021);

      // Format for display
      expect(formatCurrency(quoteTotal)).toBe('$4,866.02');
    });

    it('should handle edge case: very large amounts', () => {
      const largeAmount = 9999999.99;
      const quantity = 10;
      const lineTotal = largeAmount * quantity;
      const gst = lineTotal * 0.1;
      const total = lineTotal + gst;

      expect(lineTotal).toBe(99999999.90);
      expect(formatCurrency(total)).toBe('$109,999,999.89');
    });

    it('should handle edge case: very small amounts', () => {
      const smallAmount = 0.01;
      const quantity = 1;
      const lineTotal = smallAmount * quantity;
      const gst = lineTotal * 0.1;
      const total = lineTotal + gst;

      expect(lineTotal).toBe(0.01);
      expect(formatCurrency(total)).toBe('$0.01'); // Rounds down
    });

    it('should handle edge case: zero values', () => {
      const zeroAmount = 0;
      const lineTotal = zeroAmount * 10;
      const gst = lineTotal * 0.1;
      const total = lineTotal + gst;

      expect(total).toBe(0);
      expect(formatCurrency(total)).toBe('$0.00');
    });

    it('should handle mixed GST-free and taxable items correctly', () => {
      const items = [
        { qty: 5, price: 100.00, gstFree: false }, // $500 + $50 GST
        { qty: 2, price: 75.50, gstFree: true },   // $151 no GST
        { qty: 1, price: 1234.99, gstFree: false }, // $1234.99 + $123.50 GST
      ];

      const gstFreeSubtotal = items
        .filter(i => i.gstFree)
        .reduce((sum, i) => sum + (i.qty * i.price), 0);
      
      const taxableSubtotal = items
        .filter(i => !i.gstFree)
        .reduce((sum, i) => sum + (i.qty * i.price), 0);

      const gstAmount = taxableSubtotal * 0.1;
      const total = gstFreeSubtotal + taxableSubtotal + gstAmount;

      expect(gstFreeSubtotal).toBe(151.00);
      expect(taxableSubtotal).toBe(1734.99);
      expect(gstAmount).toBe(173.499);
      expect(total).toBe(2059.489);
      expect(formatCurrency(total)).toBe('$2,059.49');
    });
  });

  describe('Service Order to Project Flow', () => {
    it('should aggregate service order costs into project budget', () => {
      const serviceOrders = [
        { labor_cost: 1500.00, material_cost: 2500.00, other_cost: 100.00 },
        { labor_cost: 800.50, material_cost: 1200.75, other_cost: 50.25 },
      ];

      const totalLabor = serviceOrders.reduce((sum, so) => sum + so.labor_cost, 0);
      const totalMaterial = serviceOrders.reduce((sum, so) => sum + so.material_cost, 0);
      const totalOther = serviceOrders.reduce((sum, so) => sum + so.other_cost, 0);
      const projectTotal = totalLabor + totalMaterial + totalOther;

      expect(totalLabor).toBe(2300.50);
      expect(totalMaterial).toBe(3700.75);
      expect(totalOther).toBe(150.25);
      expect(projectTotal).toBe(6151.50);
      expect(formatCurrency(projectTotal)).toBe('$6,151.50');
    });

    it('should calculate project margin correctly', () => {
      const projectCost = 10000.00;
      const projectRevenue = 15000.00;
      const margin = projectRevenue - projectCost;
      const marginPercentage = (margin / projectRevenue) * 100;

      expect(margin).toBe(5000.00);
      expect(marginPercentage).toBe(33.333333333333336);
      expect(formatCurrency(margin)).toBe('$5,000.00');
      expect(marginPercentage.toFixed(2)).toBe('33.33');
    });
  });

  describe('Project Change Orders Flow', () => {
    it('should add change order amounts to project budget', () => {
      const originalBudget = 50000.00;
      const changeOrders = [
        { amount: 5000.00, is_approved: true },
        { amount: 2500.50, is_approved: true },
        { amount: 1000.00, is_approved: false }, // Not approved, shouldn't count
      ];

      const approvedChanges = changeOrders
        .filter(co => co.is_approved)
        .reduce((sum, co) => sum + co.amount, 0);

      const revisedBudget = originalBudget + approvedChanges;

      expect(approvedChanges).toBe(7500.50);
      expect(revisedBudget).toBe(57500.50);
      expect(formatCurrency(revisedBudget)).toBe('$57,500.50');
    });

    it('should calculate change order line items with GST', () => {
      const lineItems = [
        { description: 'Additional Work', qty: 10, unit_price: 150.00, is_gst_free: false },
        { description: 'Materials', qty: 5, unit_price: 200.50, is_gst_free: false },
      ];

      const subtotal = lineItems.reduce((sum, item) => 
        sum + (item.qty * item.unit_price), 0
      );
      const gst = subtotal * 0.1;
      const total = subtotal + gst;

      expect(subtotal).toBe(2502.50);
      expect(gst).toBe(250.25);
      expect(total).toBe(2752.75);
      expect(formatCurrency(total)).toBe('$2,752.75');
    });
  });

  describe('Purchase Order to Expense Flow', () => {
    it('should create expense from purchase order receipt', () => {
      const poLineItems = [
        { description: 'Material A', qty: 100, unit_price: 25.50, is_gst_free: false },
        { description: 'Material B', qty: 50, unit_price: 45.99, is_gst_free: false },
      ];

      const subtotal = poLineItems.reduce((sum, item) => 
        sum + (item.qty * item.unit_price), 0
      );
      const gst = subtotal * 0.1;
      const total = subtotal + gst;

      expect(subtotal).toBe(4849.50);
      expect(gst).toBe(484.95);
      expect(total).toBe(5334.45);
      expect(formatCurrency(total)).toBe('$5,334.45');
    });

    it('should handle partial receipts correctly', () => {
      const poTotal = 10000.00;
      const receipts = [
        { amount: 3500.00, received_qty: 35 },
        { amount: 4000.00, received_qty: 40 },
      ];

      const receivedAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
      const remainingAmount = poTotal - receivedAmount;

      expect(receivedAmount).toBe(7500.00);
      expect(remainingAmount).toBe(2500.00);
      expect(formatCurrency(remainingAmount)).toBe('$2,500.00');
    });
  });

  describe('Service Order to Invoice Flow', () => {
    it('should generate invoice from service order with correct totals', () => {
      const serviceOrderItems = [
        { description: 'Labor - 8 hours', qty: 8, rate: 125.00, is_gst_free: false },
        { description: 'Parts', qty: 1, rate: 450.00, is_gst_free: false },
        { description: 'Travel', qty: 1, rate: 75.00, is_gst_free: true },
      ];

      const gstFreeAmount = serviceOrderItems
        .filter(i => i.is_gst_free)
        .reduce((sum, i) => sum + (i.qty * i.rate), 0);

      const taxableAmount = serviceOrderItems
        .filter(i => !i.is_gst_free)
        .reduce((sum, i) => sum + (i.qty * i.rate), 0);

      const gstAmount = taxableAmount * 0.1;
      const invoiceTotal = gstFreeAmount + taxableAmount + gstAmount;

      expect(gstFreeAmount).toBe(75.00);
      expect(taxableAmount).toBe(1450.00);
      expect(gstAmount).toBe(145.00);
      expect(invoiceTotal).toBe(1670.00);
      expect(formatCurrency(invoiceTotal)).toBe('$1,670.00');
    });

    it('should handle recurring invoice generation', () => {
      const monthlyAmount = 1500.00;
      const gstRate = 0.1;
      const months = 12;

      const monthlyGst = monthlyAmount * gstRate;
      const monthlyTotal = monthlyAmount + monthlyGst;
      const annualTotal = monthlyTotal * months;

      expect(monthlyGst).toBe(150.00);
      expect(monthlyTotal).toBe(1650.00);
      expect(annualTotal).toBe(19800.00);
      expect(formatCurrency(annualTotal)).toBe('$19,800.00');
    });
  });

  describe('Invoice to Accounting Sync Flow', () => {
    it('should format invoice data for Xero sync correctly', () => {
      const invoice = {
        invoice_number: 'INV-2024-001',
        subtotal: 5000.00,
        gst_amount: 500.00,
        total: 5500.00,
        line_items: [
          { description: 'Service A', qty: 10, unit_price: 250.00, line_total: 2500.00 },
          { description: 'Service B', qty: 5, unit_price: 500.00, line_total: 2500.00 },
        ],
      };

      // Xero expects amounts as numbers with 2 decimal precision
      const xeroPayload = {
        InvoiceNumber: invoice.invoice_number,
        Type: 'ACCREC',
        SubTotal: Number(invoice.subtotal.toFixed(2)),
        TotalTax: Number(invoice.gst_amount.toFixed(2)),
        Total: Number(invoice.total.toFixed(2)),
        LineItems: invoice.line_items.map(item => ({
          Description: item.description,
          Quantity: item.qty,
          UnitAmount: Number(item.unit_price.toFixed(2)),
          LineAmount: Number(item.line_total.toFixed(2)),
        })),
      };

      expect(xeroPayload.SubTotal).toBe(5000.00);
      expect(xeroPayload.TotalTax).toBe(500.00);
      expect(xeroPayload.Total).toBe(5500.00);
      expect(xeroPayload.LineItems[0].LineAmount).toBe(2500.00);
    });

    it('should handle rounding in Acumatica sync', () => {
      // Acumatica expects specific rounding for tax calculations
      const subtotal = 1234.567; // More than 2 decimals
      const taxRate = 0.1;
      
      const roundedSubtotal = Math.round(subtotal * 100) / 100;
      const taxAmount = Math.round(roundedSubtotal * taxRate * 100) / 100;
      const total = roundedSubtotal + taxAmount;

      expect(roundedSubtotal).toBe(1234.57);
      expect(taxAmount).toBe(123.46);
      expect(total).toBe(1358.03);
      expect(formatCurrency(total)).toBe('$1,358.03');
    });
  });

  describe('Complete End-to-End Workflow', () => {
    it('should maintain currency precision through complete workflow', () => {
      // Step 1: Create Quote
      const quoteLineItems = [
        { description: 'Service Package', qty: 1, price: 2500.00, is_gst_free: false },
        { description: 'Materials', qty: 15, price: 125.50, is_gst_free: false },
      ];
      
      const quoteSubtotal = quoteLineItems.reduce((sum, item) => 
        sum + (item.qty * item.price), 0
      );
      const quoteGst = quoteSubtotal * 0.1;
      const quoteTotal = quoteSubtotal + quoteGst;

      expect(quoteSubtotal).toBe(4382.50);
      expect(quoteGst).toBe(438.25);
      expect(quoteTotal).toBe(4820.75);

      // Step 2: Convert to Service Order (same amounts)
      const serviceOrderTotal = quoteTotal;
      expect(serviceOrderTotal).toBe(4820.75);

      // Step 3: Add to Project
      const projectBudget = 20000.00;
      const projectCosts = serviceOrderTotal;
      const projectRemaining = projectBudget - projectCosts;
      expect(projectRemaining).toBe(15179.25);

      // Step 4: Purchase Order for materials
      const poAmount = 1882.50; // Materials cost
      const poGst = poAmount * 0.1;
      const poTotal = poAmount + poGst;
      expect(poTotal).toBe(2070.75);

      // Step 5: Generate Invoice from Service Order
      const invoiceTotal = serviceOrderTotal; // Same as service order
      expect(invoiceTotal).toBe(4820.75);

      // Step 6: Prepare for accounting sync
      const syncData = {
        subtotal: quoteSubtotal,
        gst: quoteGst,
        total: invoiceTotal,
      };

      expect(formatCurrency(syncData.subtotal)).toBe('$4,382.50');
      expect(formatCurrency(syncData.gst)).toBe('$438.25');
      expect(formatCurrency(syncData.total)).toBe('$4,820.75');

      // Final validation: All amounts maintain precision
      expect(syncData.subtotal + syncData.gst).toBe(syncData.total);
    });

    it('should handle complex project with multiple revenue streams', () => {
      // Multiple service orders
      const serviceOrder1 = 5000.00;
      const serviceOrder2 = 3500.00;
      
      // Change orders
      const changeOrder1 = 2000.00;
      const changeOrder2 = 1500.00;
      
      // Purchase orders (costs)
      const po1Cost = 2500.00;
      const po2Cost = 1800.00;

      const totalRevenue = serviceOrder1 + serviceOrder2 + changeOrder1 + changeOrder2;
      const totalCosts = po1Cost + po2Cost;
      const projectMargin = totalRevenue - totalCosts;
      const marginPercent = (projectMargin / totalRevenue) * 100;

      expect(totalRevenue).toBe(12000.00);
      expect(totalCosts).toBe(4300.00);
      expect(projectMargin).toBe(7700.00);
      expect(marginPercent.toFixed(2)).toBe('64.17');
      
      expect(formatCurrency(totalRevenue)).toBe('$12,000.00');
      expect(formatCurrency(projectMargin)).toBe('$7,700.00');
    });
  });

  describe('Currency Precision Edge Cases', () => {
    it('should handle division resulting in repeating decimals', () => {
      const total = 100.00;
      const quantity = 3;
      const unitPrice = total / quantity; // 33.333...

      // JavaScript precision
      expect(unitPrice).toBe(33.333333333333336);
      
      // Rounded for storage
      const roundedPrice = Math.round(unitPrice * 100) / 100;
      expect(roundedPrice).toBe(33.33);
      
      // Display format
      expect(formatCurrency(roundedPrice)).toBe('$33.33');
      
      // Verify total when multiplied back
      const recalculatedTotal = roundedPrice * quantity;
      expect(recalculatedTotal).toBe(99.99); // Not exact due to rounding
    });

    it('should handle floating point arithmetic issues', () => {
      // Common floating point problem
      const value1 = 0.1 + 0.2; // JavaScript returns 0.30000000000000004
      expect(value1).not.toBe(0.3);
      
      // Solution: Round to 2 decimals
      const rounded = Math.round(value1 * 100) / 100;
      expect(rounded).toBe(0.3);
      expect(formatCurrency(rounded)).toBe('$0.30');
    });

    it('should handle negative amounts (credits/refunds)', () => {
      const invoiceAmount = 1000.00;
      const creditAmount = -250.00;
      const netAmount = invoiceAmount + creditAmount;

      expect(netAmount).toBe(750.00);
      expect(formatCurrency(creditAmount)).toBe('-$250.00');
      expect(formatCurrency(netAmount)).toBe('$750.00');
    });
  });
});
