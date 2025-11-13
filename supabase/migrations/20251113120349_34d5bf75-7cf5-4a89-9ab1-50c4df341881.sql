-- Add preferred date columns to service_orders for capacity planning
ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS preferred_date date,
ADD COLUMN IF NOT EXISTS preferred_date_range integer DEFAULT 7;