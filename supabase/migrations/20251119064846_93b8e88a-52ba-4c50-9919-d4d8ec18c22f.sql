-- Add xero_contact_id fields to customers and suppliers tables for account linking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS xero_contact_id text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS xero_contact_id text;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_xero_contact_id ON customers(xero_contact_id) WHERE xero_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_xero_contact_id ON suppliers(xero_contact_id) WHERE xero_contact_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN customers.xero_contact_id IS 'Xero Contact ID for syncing with Xero accounting system';
COMMENT ON COLUMN suppliers.xero_contact_id IS 'Xero Contact ID for syncing with Xero accounting system';