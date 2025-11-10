-- Remove assigned_to column from service_orders table
-- Workers should only be assigned at the appointment level
ALTER TABLE public.service_orders 
DROP COLUMN IF EXISTS assigned_to;