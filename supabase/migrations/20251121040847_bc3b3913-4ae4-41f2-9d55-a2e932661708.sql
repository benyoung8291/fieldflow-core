-- Add Acumatica invoice tracking fields to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS acumatica_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS acumatica_reference_nbr TEXT,
ADD COLUMN IF NOT EXISTS acumatica_status TEXT,
ADD COLUMN IF NOT EXISTS synced_to_accounting_at TIMESTAMP WITH TIME ZONE;