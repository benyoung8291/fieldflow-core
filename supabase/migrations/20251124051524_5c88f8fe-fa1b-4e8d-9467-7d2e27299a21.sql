-- Add unique constraint to prevent duplicate quote numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_quote_number_tenant 
ON quotes(quote_number, tenant_id) 
WHERE quote_number IS NOT NULL;