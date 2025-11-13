-- Add customer_location_id to customer_locations table for external customer location identifiers
ALTER TABLE customer_locations 
ADD COLUMN customer_location_id text;