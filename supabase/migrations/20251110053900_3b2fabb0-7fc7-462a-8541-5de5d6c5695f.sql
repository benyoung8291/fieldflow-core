-- Fix the incorrect foreign key relationship for service_orders.project_id
-- It should point to projects table, not customers table

-- Drop the incorrect foreign key
ALTER TABLE public.service_orders 
DROP CONSTRAINT IF EXISTS service_orders_project_id_fkey;

-- Add the correct foreign key pointing to projects
ALTER TABLE public.service_orders 
ADD CONSTRAINT service_orders_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES public.projects(id) 
ON DELETE SET NULL;