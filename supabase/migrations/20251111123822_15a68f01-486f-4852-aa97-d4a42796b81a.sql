-- Add Microsoft email sync columns to helpdesk_tickets
ALTER TABLE helpdesk_tickets
ADD COLUMN IF NOT EXISTS microsoft_message_id TEXT,
ADD COLUMN IF NOT EXISTS microsoft_conversation_id TEXT,
ADD COLUMN IF NOT EXISTS sender_email TEXT,
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS external_email TEXT;

-- Create index on microsoft_message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_microsoft_message_id 
ON helpdesk_tickets(microsoft_message_id);

-- Add comment
COMMENT ON COLUMN helpdesk_tickets.microsoft_message_id IS 'Unique message ID from Microsoft Graph API';
COMMENT ON COLUMN helpdesk_tickets.microsoft_conversation_id IS 'Conversation/thread ID from Microsoft Graph API';
COMMENT ON COLUMN helpdesk_tickets.sender_email IS 'Email address of the ticket sender';
COMMENT ON COLUMN helpdesk_tickets.sender_name IS 'Display name of the ticket sender';
COMMENT ON COLUMN helpdesk_tickets.external_email IS 'External email address for tickets not linked to customers';