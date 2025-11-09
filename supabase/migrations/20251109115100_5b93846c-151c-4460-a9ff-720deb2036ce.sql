-- Add estimated_hours column to service_order_line_items table
ALTER TABLE public.service_order_line_items 
ADD COLUMN estimated_hours numeric DEFAULT 0 NOT NULL;