import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/utils';

/**
 * Financial Data Transformation Tests
 * 
 * Tests data transformations between different document types:
 * - Quote → Service Order
 * - Service Order → Invoice
 * - Quote → Project
 * - Change Order → Project Update
 * - Purchase Order → Expense
 */

describe('Financial Data Transformations', () => {
  describe('Quote to Service Order Transformation', () => {
    it('should transform quote line items to service order format', () => {
      const quoteLineItems = [
        {
          id: '1',
          description: 'Installation Service',
          quantity: 1,
          unit_price: 500.00,
          line_total: 500.00,
          is_gst_free: false,
        },
        {
          id: '2',
          description: 'Materials',
          quantity: 10,
          unit_price: 50.00,
          line_total: 500.00,
          is_gst_free: false,
        },
      ];

      // Transform to service order format
      const serviceOrderItems = quoteLineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_price,
        total_cost: item.line_total,
        is_gst_free: item.is_gst_free,
      }));

      expect(serviceOrderItems).toHaveLength(2);
      expect(serviceOrderItems[0].total_cost).toBe(500.00);
      expect(serviceOrderItems[1].total_cost).toBe(500.00);

      const soTotal = serviceOrderItems.reduce((sum, item) => sum + item.total_cost, 0);
      expect(soTotal).toBe(1000.00);
      expect(formatCurrency(soTotal)).toBe('$1,000.00');
    });

    it('should preserve GST-free status in transformation', () => {
      const quoteItems = [
        { amount: 100, is_gst_free: true },
        { amount: 200, is_gst_free: false },
      ];

      const serviceOrderItems = quoteItems.map(item => ({
        amount: item.amount,
        is_gst_free: item.is_gst_free,
      }));

      expect(serviceOrderItems[0].is_gst_free).toBe(true);
      expect(serviceOrderItems[1].is_gst_free).toBe(false);
    });
  });

  describe('Service Order to Invoice Transformation', () => {
    it('should convert service order to invoice with correct amounts', () => {
      const serviceOrder = {
        id: 'SO-001',
        line_items: [
          { description: 'Labor', hours: 8, rate: 125.00, is_gst_free: false },
          { description: 'Materials', quantity: 1, rate: 350.00, is_gst_free: false },
        ],
      };

      // Calculate service order totals
      const soSubtotal = serviceOrder.line_items.reduce((sum, item) => {
        const qty = (item.hours || item.quantity) || 1;
        return sum + (qty * item.rate);
      }, 0);

      const soGst = soSubtotal * 0.1;
      const soTotal = soSubtotal + soGst;

      // Create invoice from service order
      const invoice = {
        service_order_id: serviceOrder.id,
        subtotal: soSubtotal,
        gst_amount: soGst,
        total: soTotal,
        line_items: serviceOrder.line_items.map(item => ({
          description: item.description,
          quantity: (item.hours || item.quantity) || 1,
          unit_price: item.rate,
          line_total: ((item.hours || item.quantity) || 1) * item.rate,
          is_gst_free: item.is_gst_free,
        })),
      };

      expect(invoice.subtotal).toBe(1350.00);
      expect(invoice.gst_amount).toBe(135.00);
      expect(invoice.total).toBe(1485.00);
      expect(formatCurrency(invoice.total)).toBe('$1,485.00');
    });

    it('should handle time-based billing conversion', () => {
      const serviceOrder = {
        time_logs: [
          { hours: 4.5, rate: 150.00 },
          { hours: 2.0, rate: 150.00 },
          { hours: 3.25, rate: 150.00 },
        ],
      };

      const totalHours = serviceOrder.time_logs.reduce((sum, log) => sum + log.hours, 0);
      const laborCost = serviceOrder.time_logs.reduce((sum, log) => 
        sum + (log.hours * log.rate), 0
      );

      expect(totalHours).toBe(9.75);
      expect(laborCost).toBe(1462.50);
      expect(formatCurrency(laborCost)).toBe('$1,462.50');
    });
  });

  describe('Quote to Project Budget Transformation', () => {
    it('should initialize project budget from quote', () => {
      const quote = {
        id: 'Q-001',
        subtotal: 50000.00,
        gst_amount: 5000.00,
        total: 55000.00,
        margin_percentage: 30,
      };

      // Calculate estimated costs from margin
      const estimatedRevenue = quote.subtotal;
      const estimatedCosts = estimatedRevenue * (1 - (quote.margin_percentage / 100));
      const estimatedMargin = estimatedRevenue - estimatedCosts;

      const projectBudget = {
        quote_id: quote.id,
        budgeted_revenue: estimatedRevenue,
        budgeted_costs: estimatedCosts,
        budgeted_margin: estimatedMargin,
        margin_percentage: quote.margin_percentage,
      };

      expect(projectBudget.budgeted_revenue).toBe(50000.00);
      expect(projectBudget.budgeted_costs).toBe(35000.00);
      expect(projectBudget.budgeted_margin).toBe(15000.00);
      expect(formatCurrency(projectBudget.budgeted_margin)).toBe('$15,000.00');
    });
  });

  describe('Change Order to Project Update', () => {
    it('should update project budget with approved change order', () => {
      const project = {
        original_budget: 50000.00,
        revised_budget: 50000.00,
        actual_costs: 30000.00,
      };

      const changeOrder = {
        description: 'Additional Scope',
        amount: 7500.00,
        is_approved: true,
      };

      if (changeOrder.is_approved) {
        project.revised_budget += changeOrder.amount;
      }

      const remainingBudget = project.revised_budget - project.actual_costs;

      expect(project.revised_budget).toBe(57500.00);
      expect(remainingBudget).toBe(27500.00);
      expect(formatCurrency(project.revised_budget)).toBe('$57,500.00');
    });

    it('should calculate change order impact on margin', () => {
      const project = {
        budgeted_revenue: 50000.00,
        budgeted_costs: 35000.00,
        budgeted_margin: 15000.00,
      };

      const changeOrder = {
        revenue_impact: 8000.00,
        cost_impact: 5000.00,
      };

      const updatedRevenue = project.budgeted_revenue + changeOrder.revenue_impact;
      const updatedCosts = project.budgeted_costs + changeOrder.cost_impact;
      const updatedMargin = updatedRevenue - updatedCosts;
      const marginPercentage = (updatedMargin / updatedRevenue) * 100;

      expect(updatedRevenue).toBe(58000.00);
      expect(updatedCosts).toBe(40000.00);
      expect(updatedMargin).toBe(18000.00);
      expect(marginPercentage.toFixed(2)).toBe('31.03');
    });
  });

  describe('Purchase Order to Expense Transformation', () => {
    it('should create expense from received purchase order', () => {
      const purchaseOrder = {
        id: 'PO-001',
        supplier_id: 'SUP-001',
        line_items: [
          { description: 'Material A', qty: 100, unit_price: 25.00, is_gst_free: false },
          { description: 'Material B', qty: 50, unit_price: 40.00, is_gst_free: false },
        ],
      };

      const poSubtotal = purchaseOrder.line_items.reduce((sum, item) => 
        sum + (item.qty * item.unit_price), 0
      );
      const poGst = poSubtotal * 0.1;
      const poTotal = poSubtotal + poGst;

      const expense = {
        purchase_order_id: purchaseOrder.id,
        vendor_id: purchaseOrder.supplier_id,
        amount: poSubtotal,
        gst_amount: poGst,
        total_amount: poTotal,
        description: `PO Receipt: ${purchaseOrder.id}`,
        status: 'approved',
      };

      expect(expense.amount).toBe(4500.00);
      expect(expense.gst_amount).toBe(450.00);
      expect(expense.total_amount).toBe(4950.00);
      expect(formatCurrency(expense.total_amount)).toBe('$4,950.00');
    });

    it('should handle partial purchase order receipt', () => {
      const poLineItem = {
        description: 'Materials',
        ordered_qty: 100,
        unit_price: 50.00,
        total_ordered: 5000.00,
      };

      const receipt = {
        received_qty: 60,
        damaged_qty: 2,
      };

      const acceptedQty = receipt.received_qty - receipt.damaged_qty;
      const acceptedAmount = acceptedQty * poLineItem.unit_price;
      const remainingQty = poLineItem.ordered_qty - receipt.received_qty;
      const remainingAmount = remainingQty * poLineItem.unit_price;

      expect(acceptedQty).toBe(58);
      expect(acceptedAmount).toBe(2900.00);
      expect(remainingQty).toBe(40);
      expect(remainingAmount).toBe(2000.00);
      expect(formatCurrency(acceptedAmount)).toBe('$2,900.00');
    });
  });

  describe('Assembly Item Expansion', () => {
    it('should expand assembly items into component line items', () => {
      const assembly = {
        name: 'Installation Package',
        sell_price: 1000.00,
        components: [
          { description: 'Labor', quantity: 4, cost: 125.00 },
          { description: 'Materials', quantity: 1, cost: 200.00 },
          { description: 'Equipment', quantity: 1, cost: 150.00 },
        ],
      };

      const totalComponentCost = assembly.components.reduce((sum, comp) => 
        sum + (comp.quantity * comp.cost), 0
      );
      const assemblyMargin = assembly.sell_price - totalComponentCost;
      const marginPercent = (assemblyMargin / assembly.sell_price) * 100;

      expect(totalComponentCost).toBe(850.00);
      expect(assemblyMargin).toBe(150.00);
      expect(marginPercent).toBe(15);
      expect(formatCurrency(assembly.sell_price)).toBe('$1,000.00');
    });
  });

  describe('Recurring Invoice Generation', () => {
    it('should generate recurring invoice from contract', () => {
      const contract = {
        id: 'CONTRACT-001',
        monthly_amount: 2500.00,
        start_date: '2024-01-01',
        billing_frequency: 'monthly',
        is_gst_included: false,
      };

      const recurringInvoice = {
        contract_id: contract.id,
        subtotal: contract.monthly_amount,
        gst_amount: contract.is_gst_included ? 0 : contract.monthly_amount * 0.1,
        total: 0,
      };

      recurringInvoice.total = recurringInvoice.subtotal + recurringInvoice.gst_amount;

      expect(recurringInvoice.subtotal).toBe(2500.00);
      expect(recurringInvoice.gst_amount).toBe(250.00);
      expect(recurringInvoice.total).toBe(2750.00);
      expect(formatCurrency(recurringInvoice.total)).toBe('$2,750.00');
    });

    it('should prorate first month recurring invoice', () => {
      const contract = {
        monthly_amount: 3000.00,
        start_date: new Date('2024-01-15'),
      };

      const daysInMonth = 31;
      const daysRemaining = 17; // 15th to 31st
      const proratedAmount = (contract.monthly_amount / daysInMonth) * daysRemaining;
      const gst = proratedAmount * 0.1;
      const total = proratedAmount + gst;

      expect(proratedAmount.toFixed(2)).toBe('1645.16');
      expect(gst.toFixed(2)).toBe('164.52');
      expect(total.toFixed(2)).toBe('1809.68');
      expect(formatCurrency(parseFloat(total.toFixed(2)))).toBe('$1,809.68');
    });
  });

  describe('Data Integrity Checks', () => {
    it('should verify line item totals match document total', () => {
      const document = {
        line_items: [
          { description: 'Item 1', line_total: 1000.00 },
          { description: 'Item 2', line_total: 1500.00 },
          { description: 'Item 3', line_total: 750.00 },
        ],
        subtotal: 3250.00,
        gst_amount: 325.00,
        total: 3575.00,
      };

      const calculatedSubtotal = document.line_items.reduce((sum, item) => 
        sum + item.line_total, 0
      );
      const calculatedGst = calculatedSubtotal * 0.1;
      const calculatedTotal = calculatedSubtotal + calculatedGst;

      expect(calculatedSubtotal).toBe(document.subtotal);
      expect(calculatedGst).toBe(document.gst_amount);
      expect(calculatedTotal).toBe(document.total);
    });

    it('should detect and report precision loss', () => {
      const values = [123.456, 789.123, 456.789];
      
      // Store with 2 decimal precision
      const stored = values.map(v => Math.round(v * 100) / 100);
      
      // Calculate precision loss
      const precisionLoss = values.map((original, index) => 
        Math.abs(original - stored[index])
      );

      expect(stored[0]).toBe(123.46);
      expect(stored[1]).toBe(789.12);
      expect(stored[2]).toBe(456.79);
      
      expect(precisionLoss[0]).toBeCloseTo(0.004);
      expect(precisionLoss[1]).toBeCloseTo(0.003);
      expect(precisionLoss[2]).toBeCloseTo(0.001);
    });
  });
});
