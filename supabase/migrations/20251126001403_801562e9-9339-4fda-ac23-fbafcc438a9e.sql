-- Add worker_can_contact_customer field to service_orders table
ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS worker_can_contact_customer boolean DEFAULT false;

COMMENT ON COLUMN service_orders.worker_can_contact_customer IS 'Whether workers are allowed to contact the customer directly for this service order';