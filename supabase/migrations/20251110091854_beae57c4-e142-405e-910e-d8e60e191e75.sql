-- Create recurring invoices table (master templates)
CREATE TABLE recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  invoice_number_prefix TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  next_invoice_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recurring invoice line items table
CREATE TABLE recurring_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add recurring invoice reference to invoices table
ALTER TABLE invoices ADD COLUMN recurring_invoice_id UUID REFERENCES recurring_invoices(id) ON DELETE SET NULL;

-- Enable RLS on recurring invoices
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for recurring invoices
CREATE POLICY "Users can view recurring invoices in their tenant"
  ON recurring_invoices FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create recurring invoices in their tenant"
  ON recurring_invoices FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update recurring invoices in their tenant"
  ON recurring_invoices FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete recurring invoices in their tenant"
  ON recurring_invoices FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS policies for recurring invoice line items
CREATE POLICY "Users can view recurring invoice line items in their tenant"
  ON recurring_invoice_line_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create recurring invoice line items in their tenant"
  ON recurring_invoice_line_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update recurring invoice line items in their tenant"
  ON recurring_invoice_line_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete recurring invoice line items in their tenant"
  ON recurring_invoice_line_items FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create index for faster queries
CREATE INDEX idx_recurring_invoices_tenant ON recurring_invoices(tenant_id);
CREATE INDEX idx_recurring_invoices_next_date ON recurring_invoices(next_invoice_date) WHERE is_active = true;
CREATE INDEX idx_recurring_invoice_line_items_recurring_invoice ON recurring_invoice_line_items(recurring_invoice_id);
CREATE INDEX idx_invoices_recurring_invoice ON invoices(recurring_invoice_id);