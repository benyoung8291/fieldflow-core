-- Drop the old constraint
ALTER TABLE public.helpdesk_messages DROP CONSTRAINT IF EXISTS helpdesk_messages_message_type_check;

-- Add updated constraint with new message types
ALTER TABLE public.helpdesk_messages ADD CONSTRAINT helpdesk_messages_message_type_check 
  CHECK (message_type IN ('email', 'note', 'status_change', 'task', 'checklist', 'internal_note'));