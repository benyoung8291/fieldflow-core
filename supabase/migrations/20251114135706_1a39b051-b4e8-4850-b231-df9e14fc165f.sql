-- Add task_id column to helpdesk_messages table for linking checklist messages to tasks
ALTER TABLE helpdesk_messages 
ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE CASCADE;