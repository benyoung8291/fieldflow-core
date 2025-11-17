-- Add archived fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Create index for archived leads
CREATE INDEX IF NOT EXISTS idx_leads_archived ON public.leads(is_archived, tenant_id);