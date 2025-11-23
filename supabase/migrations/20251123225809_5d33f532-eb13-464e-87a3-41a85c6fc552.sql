
-- Add service order generation settings to general_settings
ALTER TABLE general_settings
ADD COLUMN IF NOT EXISTS service_order_generation_lookahead_days INTEGER DEFAULT 30;

COMMENT ON COLUMN general_settings.service_order_generation_lookahead_days IS 
'Number of days to look ahead when automatically generating service orders from contracts. Default is 30 days.';

-- Update the function to handle deleted service orders by checking if the service order still exists
-- (The existing logic already handles this correctly - it checks for existence in the WHERE clause)
-- If a service order is deleted, it won't exist in the join, so it will be regenerated
