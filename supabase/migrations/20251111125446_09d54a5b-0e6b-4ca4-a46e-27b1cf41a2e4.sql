-- Add new columns to helpdesk_tickets for enhanced functionality
ALTER TABLE public.helpdesk_tickets
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assigned_to ON public.helpdesk_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_is_read ON public.helpdesk_tickets(is_read);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_is_archived ON public.helpdesk_tickets(is_archived);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_tags ON public.helpdesk_tickets USING GIN(tags);

-- Add status options (can be customized later)
COMMENT ON COLUMN public.helpdesk_tickets.status IS 'Status options: open, in_progress, waiting_response, resolved, closed';