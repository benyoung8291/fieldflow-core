-- Allow tasks to exist without linked records (for standalone tasks)
ALTER TABLE public.tasks 
ALTER COLUMN linked_module DROP NOT NULL,
ALTER COLUMN linked_record_id DROP NOT NULL;