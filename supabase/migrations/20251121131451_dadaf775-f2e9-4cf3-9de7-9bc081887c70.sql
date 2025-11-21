-- Add Acumatica sync tracking columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS acumatica_invoice_id text,
ADD COLUMN IF NOT EXISTS acumatica_reference_nbr text,
ADD COLUMN IF NOT EXISTS sync_status text;