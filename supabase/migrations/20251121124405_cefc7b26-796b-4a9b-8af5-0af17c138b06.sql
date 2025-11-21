
-- Add supplier_invoice_number column for AP invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS supplier_invoice_number text;

-- Add index for searching
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_invoice_number 
ON invoices(supplier_invoice_number) 
WHERE supplier_invoice_number IS NOT NULL;

-- Add comment
COMMENT ON COLUMN invoices.supplier_invoice_number IS 'The invoice number from the supplier (used for AP invoices)';
