import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/utils';

/**
 * GST (Goods and Services Tax) Calculation Tests
 * 
 * Australian GST is 10% (0.1 rate)
 * Tests various scenarios for GST calculations across financial documents
 */

describe('GST Calculations', () => {
  const GST_RATE = 0.1; // 10%

  describe('Basic GST Calculations', () => {
    it('should calculate GST on taxable amount', () => {
      const taxableAmount = 1000.00;
      const gst = taxableAmount * GST_RATE;
      const total = taxableAmount + gst;

      expect(gst).toBe(100.00);
      expect(total).toBe(1100.00);
      expect(formatCurrency(total)).toBe('$1,100.00');
    });

    it('should calculate GST on amount with decimals', () => {
      const taxableAmount = 1234.56;
      const gst = taxableAmount * GST_RATE;
      const total = taxableAmount + gst;

      expect(gst).toBe(123.456);
      expect(total).toBe(1358.016);
      expect(formatCurrency(total)).toBe('$1,358.02');
    });

    it('should not apply GST to GST-free items', () => {
      const gstFreeAmount = 500.00;
      const gst = 0;
      const total = gstFreeAmount + gst;

      expect(gst).toBe(0);
      expect(total).toBe(500.00);
      expect(formatCurrency(total)).toBe('$500.00');
    });
  });

  describe('Mixed Taxable and GST-Free Items', () => {
    it('should calculate GST only on taxable items', () => {
      const items = [
        { amount: 1000.00, is_gst_free: false },
        { amount: 500.00, is_gst_free: true },
        { amount: 750.00, is_gst_free: false },
      ];

      const gstFreeTotal = items
        .filter(i => i.is_gst_free)
        .reduce((sum, i) => sum + i.amount, 0);

      const taxableTotal = items
        .filter(i => !i.is_gst_free)
        .reduce((sum, i) => sum + i.amount, 0);

      const gst = taxableTotal * GST_RATE;
      const total = gstFreeTotal + taxableTotal + gst;

      expect(gstFreeTotal).toBe(500.00);
      expect(taxableTotal).toBe(1750.00);
      expect(gst).toBe(175.00);
      expect(total).toBe(2425.00);
      expect(formatCurrency(total)).toBe('$2,425.00');
    });

    it('should handle multiple line items with quantities', () => {
      const lineItems = [
        { qty: 5, unit_price: 100.00, is_gst_free: false },
        { qty: 3, unit_price: 250.00, is_gst_free: true },
        { qty: 2, unit_price: 450.50, is_gst_free: false },
      ];

      const gstFreeSubtotal = lineItems
        .filter(i => i.is_gst_free)
        .reduce((sum, i) => sum + (i.qty * i.unit_price), 0);

      const taxableSubtotal = lineItems
        .filter(i => !i.is_gst_free)
        .reduce((sum, i) => sum + (i.qty * i.unit_price), 0);

      const gst = taxableSubtotal * GST_RATE;
      const total = gstFreeSubtotal + taxableSubtotal + gst;

      expect(gstFreeSubtotal).toBe(750.00);
      expect(taxableSubtotal).toBe(1401.00); // (5*100) + (2*450.5)
      expect(gst).toBe(140.1);
      expect(total).toBe(2291.1);
      expect(formatCurrency(total)).toBe('$2,291.10');
    });
  });

  describe('GST Rounding Scenarios', () => {
    it('should handle rounding when GST results in more than 2 decimals', () => {
      const amounts = [123.45, 678.91, 234.12];
      
      amounts.forEach(amount => {
        const gst = amount * GST_RATE;
        const total = amount + gst;
        const roundedTotal = Math.round(total * 100) / 100;
        
        expect(formatCurrency(roundedTotal)).toMatch(/^\$[\d,]+\.\d{2}$/);
      });
    });

    it('should accumulate GST correctly across multiple items', () => {
      // Scenario: Calculate GST per line vs total GST
      const items = [
        { amount: 123.45 },
        { amount: 234.56 },
        { amount: 345.67 },
      ];

      // Method 1: GST per line then sum
      const gstPerLine = items.map(i => i.amount * GST_RATE);
      const totalGstPerLine = gstPerLine.reduce((sum, gst) => sum + gst, 0);

      // Method 2: Sum amounts then calculate GST
      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
      const totalGstOnSubtotal = subtotal * GST_RATE;

      // Both methods should yield same result
      expect(totalGstPerLine).toBe(totalGstOnSubtotal);
      expect(totalGstPerLine).toBe(70.368);
      expect(formatCurrency(totalGstPerLine)).toBe('$70.37');
    });
  });

  describe('GST Reverse Calculations', () => {
    it('should extract GST from GST-inclusive amount', () => {
      const gstInclusiveAmount = 1100.00;
      // GST = Amount / 11 for 10% GST
      const gst = gstInclusiveAmount / 11;
      const excludingGst = gstInclusiveAmount - gst;

      expect(gst).toBe(100);
      expect(excludingGst).toBe(1000);
      expect(formatCurrency(excludingGst)).toBe('$1,000.00');
      expect(formatCurrency(gst)).toBe('$100.00');
    });

    it('should handle reverse GST calculation with decimals', () => {
      const gstInclusiveAmount = 1234.56;
      const gst = gstInclusiveAmount / 11;
      const excludingGst = gstInclusiveAmount - gst;

      expect(gst).toBe(112.23272727272727);
      expect(excludingGst).toBe(1122.3272727272727);
      
      const roundedGst = Math.round(gst * 100) / 100;
      const roundedExcludingGst = Math.round(excludingGst * 100) / 100;
      
      expect(roundedGst).toBe(112.23);
      expect(roundedExcludingGst).toBe(1122.33);
      expect(formatCurrency(roundedGst)).toBe('$112.23');
    });
  });

  describe('GST Compliance Scenarios', () => {
    it('should calculate GST for supply to registered business', () => {
      // B2B transaction with GST
      const supplyCost = 5000.00;
      const gst = supplyCost * GST_RATE;
      const total = supplyCost + gst;

      expect(gst).toBe(500.00);
      expect(total).toBe(5500.00);
    });

    it('should handle GST-free exports', () => {
      // Exports are typically GST-free
      const exportValue = 10000.00;
      const gst = 0; // No GST on exports
      const total = exportValue + gst;

      expect(total).toBe(10000.00);
      expect(formatCurrency(total)).toBe('$10,000.00');
    });

    it('should handle basic food items (GST-free)', () => {
      // Basic food items are GST-free in Australia
      const foodItems = [
        { description: 'Bread', amount: 5.50, is_gst_free: true },
        { description: 'Milk', amount: 3.20, is_gst_free: true },
        { description: 'Soft Drink', amount: 4.00, is_gst_free: false }, // Not basic food
      ];

      const gstFreeTotal = foodItems
        .filter(i => i.is_gst_free)
        .reduce((sum, i) => sum + i.amount, 0);

      const taxableTotal = foodItems
        .filter(i => !i.is_gst_free)
        .reduce((sum, i) => sum + i.amount, 0);

      const gst = taxableTotal * GST_RATE;
      const total = gstFreeTotal + taxableTotal + gst;

      expect(gstFreeTotal).toBe(8.70);
      expect(taxableTotal).toBe(4.00);
      expect(gst).toBe(0.4);
      expect(total).toBe(13.1);
      expect(formatCurrency(total)).toBe('$13.10');
    });
  });

  describe('GST Adjustments and Credits', () => {
    it('should handle GST on credit notes', () => {
      const creditAmount = -500.00;
      const gstOnCredit = creditAmount * GST_RATE;
      const totalCredit = creditAmount + gstOnCredit;

      expect(gstOnCredit).toBe(-50.00);
      expect(totalCredit).toBe(-550.00);
      expect(formatCurrency(totalCredit)).toBe('-$550.00');
    });

    it('should calculate GST adjustment for invoice corrections', () => {
      const originalAmount = 1000.00;
      const originalGst = originalAmount * GST_RATE;
      const originalTotal = originalAmount + originalGst;

      const correctedAmount = 1100.00;
      const correctedGst = correctedAmount * GST_RATE;
      const correctedTotal = correctedAmount + correctedGst;

      const adjustmentAmount = correctedAmount - originalAmount;
      const adjustmentGst = correctedGst - originalGst;
      const adjustmentTotal = correctedTotal - originalTotal;

      expect(adjustmentAmount).toBe(100.00);
      expect(adjustmentGst).toBe(10.00);
      expect(adjustmentTotal).toBe(110.00);
      expect(formatCurrency(adjustmentTotal)).toBe('$110.00');
    });
  });

  describe('GST on Discounts', () => {
    it('should calculate GST after applying discount', () => {
      const originalAmount = 1000.00;
      const discountPercent = 10; // 10% discount
      const discountAmount = originalAmount * (discountPercent / 100);
      const discountedAmount = originalAmount - discountAmount;
      const gst = discountedAmount * GST_RATE;
      const total = discountedAmount + gst;

      expect(discountAmount).toBe(100.00);
      expect(discountedAmount).toBe(900.00);
      expect(gst).toBe(90.00);
      expect(total).toBe(990.00);
      expect(formatCurrency(total)).toBe('$990.00');
    });

    it('should handle line-level discounts', () => {
      const lineItems = [
        { qty: 5, unit_price: 100.00, discount_percent: 10, is_gst_free: false },
        { qty: 2, unit_price: 250.00, discount_percent: 0, is_gst_free: false },
      ];

      const subtotal = lineItems.reduce((sum, item) => {
        const lineTotal = item.qty * item.unit_price;
        const discount = lineTotal * (item.discount_percent / 100);
        return sum + (lineTotal - discount);
      }, 0);

      const gst = subtotal * GST_RATE;
      const total = subtotal + gst;

      expect(subtotal).toBe(950.00); // (500 - 50) + 500
      expect(gst).toBe(95.00);
      expect(total).toBe(1045.00);
      expect(formatCurrency(total)).toBe('$1,045.00');
    });
  });

  describe('GST Reporting Totals', () => {
    it('should aggregate GST for BAS reporting', () => {
      // Business Activity Statement requires total GST collected
      const invoices = [
        { subtotal: 1000.00, gst: 100.00 },
        { subtotal: 2500.00, gst: 250.00 },
        { subtotal: 750.00, gst: 75.00 },
      ];

      const totalSales = invoices.reduce((sum, inv) => sum + inv.subtotal, 0);
      const totalGstCollected = invoices.reduce((sum, inv) => sum + inv.gst, 0);
      const totalIncludingGst = totalSales + totalGstCollected;

      expect(totalSales).toBe(4250.00);
      expect(totalGstCollected).toBe(425.00);
      expect(totalIncludingGst).toBe(4675.00);
      expect(formatCurrency(totalGstCollected)).toBe('$425.00');
    });
  });
});
