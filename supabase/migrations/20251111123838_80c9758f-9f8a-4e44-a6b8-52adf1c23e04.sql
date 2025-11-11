-- Add Microsoft email sync columns to helpdesk_messages
ALTER TABLE helpdesk_messages
ADD COLUMN IF NOT EXISTS sender_email TEXT,
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS body_html TEXT,
ADD COLUMN IF NOT EXISTS body_text TEXT,
ADD COLUMN IF NOT EXISTS is_from_customer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS microsoft_message_id TEXT,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Create index on microsoft_message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_helpdesk_messages_microsoft_message_id 
ON helpdesk_messages(microsoft_message_id);

-- Add comment
COMMENT ON COLUMN helpdesk_messages.sender_email IS 'Email address of the message sender';
COMMENT ON COLUMN helpdesk_messages.sender_name IS 'Display name of the message sender';
COMMENT ON COLUMN helpdesk_messages.body_html IS 'HTML content of the message';
COMMENT ON COLUMN helpdesk_messages.body_text IS 'Plain text content of the message';
COMMENT ON COLUMN helpdesk_messages.is_from_customer IS 'Whether the message is from the customer (true) or staff (false)';
COMMENT ON COLUMN helpdesk_messages.microsoft_message_id IS 'Unique message ID from Microsoft Graph API';
COMMENT ON COLUMN helpdesk_messages.sent_at IS 'When the message was sent/received';