-- Add response tracking columns to ticket_markups
ALTER TABLE ticket_markups 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS response_notes TEXT,
ADD COLUMN IF NOT EXISTS response_photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add completion workflow fields to helpdesk_tickets
ALTER TABLE helpdesk_tickets 
ADD COLUMN IF NOT EXISTS completion_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completion_reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS customer_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_notified_by UUID REFERENCES auth.users(id);

-- Populate notes and photo_url from existing markup_data
UPDATE ticket_markups 
SET notes = markup_data->>'notes',
    photo_url = markup_data->>'photo_url'
WHERE markup_data IS NOT NULL AND (notes IS NULL OR photo_url IS NULL);

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_ticket_markups_status ON ticket_markups(status);
CREATE INDEX IF NOT EXISTS idx_ticket_markups_ticket_id_status ON ticket_markups(ticket_id, status);