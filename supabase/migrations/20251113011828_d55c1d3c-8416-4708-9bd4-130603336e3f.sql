-- Add sync tracking fields to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS sync_status TEXT,
ADD COLUMN IF NOT EXISTS external_reference TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Create index for sync status queries
CREATE INDEX IF NOT EXISTS idx_expenses_sync_status ON public.expenses(sync_status);
CREATE INDEX IF NOT EXISTS idx_expenses_external_reference ON public.expenses(external_reference);

-- Add unique constraint to prevent duplicate syncs
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_unique_external_ref 
ON public.expenses(external_reference, tenant_id) 
WHERE external_reference IS NOT NULL;