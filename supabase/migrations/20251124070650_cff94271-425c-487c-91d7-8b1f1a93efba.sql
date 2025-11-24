-- Add bug_report to valid task modules
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_module;
ALTER TABLE tasks ADD CONSTRAINT valid_module 
  CHECK (linked_module IS NULL OR linked_module = ANY(ARRAY[
    'quote'::text, 
    'service_order'::text, 
    'appointment'::text, 
    'project'::text, 
    'customer'::text, 
    'lead'::text, 
    'contract'::text, 
    'helpdesk'::text,
    'bug_report'::text,
    'invoice'::text
  ]));

-- Add bug_report to valid notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY(ARRAY[
    'mention'::text, 
    'task_assigned'::text, 
    'task_completed'::text, 
    'comment'::text, 
    'bug_report'::text,
    'other'::text
  ]));