-- Add service order and project linkage to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS service_order_id UUID REFERENCES service_orders(id),
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Add account allocation fields to invoice_line_items
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS account_code TEXT,
ADD COLUMN IF NOT EXISTS sub_account TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_service_order_id ON invoices(service_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);

-- Add comment for documentation
COMMENT ON COLUMN invoices.service_order_id IS 'Optional link to service order for AP invoices';
COMMENT ON COLUMN invoices.project_id IS 'Optional link to project for AP invoices';
COMMENT ON COLUMN invoice_line_items.account_code IS 'Chart of accounts code from accounting integration';
COMMENT ON COLUMN invoice_line_items.sub_account IS 'Sub-account code for Acumatica integration';