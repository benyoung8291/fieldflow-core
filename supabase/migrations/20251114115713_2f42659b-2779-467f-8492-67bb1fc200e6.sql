-- Add forwarded_by field to track who forwarded an email
ALTER TABLE helpdesk_tickets 
ADD COLUMN IF NOT EXISTS forwarded_by text;

COMMENT ON COLUMN helpdesk_tickets.forwarded_by IS 'Email address of person who forwarded the email (when original sender is different)';