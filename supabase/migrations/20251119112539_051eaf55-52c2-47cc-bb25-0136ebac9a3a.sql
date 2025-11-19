-- Add account and sub-account fields to invoice line items for Acumatica integration
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS account_code TEXT,
ADD COLUMN IF NOT EXISTS sub_account TEXT;

-- Add default sales account settings to accounting integrations
ALTER TABLE accounting_integrations
ADD COLUMN IF NOT EXISTS default_sales_account_code TEXT,
ADD COLUMN IF NOT EXISTS default_sales_sub_account TEXT;

-- Add default account and sub-account to suppliers for AP invoices
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS default_account_code TEXT,
ADD COLUMN IF NOT EXISTS default_sub_account TEXT;

-- Add helpful comments
COMMENT ON COLUMN invoice_line_items.account_code IS 'Chart of accounts code for Acumatica integration';
COMMENT ON COLUMN invoice_line_items.sub_account IS 'Sub-account code for Acumatica integration (required for MYOB Acumatica)';
COMMENT ON COLUMN accounting_integrations.default_sales_account_code IS 'Default account code for AR invoice sales items';
COMMENT ON COLUMN accounting_integrations.default_sales_sub_account IS 'Default sub-account for AR invoice sales items';
COMMENT ON COLUMN suppliers.default_account_code IS 'Default account code for AP invoices from this supplier';
COMMENT ON COLUMN suppliers.default_sub_account IS 'Default sub-account for AP invoices from this supplier';