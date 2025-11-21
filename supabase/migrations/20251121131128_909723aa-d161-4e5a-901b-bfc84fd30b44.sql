-- Add sync_error column to invoices table for AP invoice sync error tracking
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS sync_error text;