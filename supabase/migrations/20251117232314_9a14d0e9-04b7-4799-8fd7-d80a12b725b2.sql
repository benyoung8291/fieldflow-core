-- Add archived_at column to service_contracts table
ALTER TABLE service_contracts ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Create index for archived contracts
CREATE INDEX IF NOT EXISTS idx_service_contracts_archived_at ON service_contracts(archived_at);

-- Update RLS policies to exclude archived contracts from normal views
-- No policy changes needed as archived contracts should still be visible to users who can see the contract