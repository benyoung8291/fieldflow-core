-- Add key_number field to service_orders table
ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS key_number text;