-- Add 'helpdesk' to the valid_module check constraint for tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_module;

ALTER TABLE tasks ADD CONSTRAINT valid_module 
CHECK (
  linked_module IS NULL OR 
  linked_module = ANY (ARRAY[
    'quote'::text, 
    'service_order'::text, 
    'appointment'::text, 
    'project'::text, 
    'customer'::text, 
    'lead'::text, 
    'contract'::text,
    'helpdesk'::text
  ])
);