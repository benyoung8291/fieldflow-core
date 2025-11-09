-- Add estimated_hours to service_orders table
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2);