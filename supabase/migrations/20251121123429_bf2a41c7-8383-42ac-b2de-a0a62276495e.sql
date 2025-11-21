-- Add columns to support AP invoices (bills from suppliers)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'ar';

-- Add check constraint to ensure invoice type is valid
ALTER TABLE invoices 
ADD CONSTRAINT invoices_type_check 
CHECK (invoice_type IN ('ar', 'ap'));

-- Modify the customer_id constraint to be optional (nullable)
-- First, we need to drop the NOT NULL constraint if it exists
ALTER TABLE invoices 
ALTER COLUMN customer_id DROP NOT NULL;

-- Add check constraint to ensure either customer_id (for AR) or supplier_id (for AP) is set
ALTER TABLE invoices 
ADD CONSTRAINT invoices_customer_or_supplier_check 
CHECK (
  (invoice_type = 'ar' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
  (invoice_type = 'ap' AND supplier_id IS NOT NULL AND customer_id IS NULL)
);

-- Create index for supplier_id for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);

-- Create index for invoice_type for better filtering
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);