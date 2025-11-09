-- Add preferred scheduling fields to service_orders table
ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS preferred_date date,
ADD COLUMN IF NOT EXISTS date_range_end date;

COMMENT ON COLUMN service_orders.preferred_date IS 'Preferred start date for scheduling this service order';
COMMENT ON COLUMN service_orders.date_range_end IS 'End date for flexible scheduling range';