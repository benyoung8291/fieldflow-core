
-- Add internet_message_id field to helpdesk_messages for proper email threading
-- This stores the RFC-compliant Message-ID header used by email clients for threading

ALTER TABLE helpdesk_messages 
ADD COLUMN IF NOT EXISTS internet_message_id TEXT;

-- Create index for fast lookups when matching In-Reply-To and References headers
CREATE INDEX IF NOT EXISTS idx_helpdesk_messages_internet_message_id 
ON helpdesk_messages(internet_message_id) 
WHERE internet_message_id IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN helpdesk_messages.internet_message_id IS 'RFC-compliant Message-ID header used for proper email threading. Incoming emails use In-Reply-To and References headers to match against this field.';
