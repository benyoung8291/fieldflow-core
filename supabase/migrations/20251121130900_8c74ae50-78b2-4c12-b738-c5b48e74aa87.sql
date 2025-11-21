-- Add last_synced_at column to invoices table for AP invoice sync tracking
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;