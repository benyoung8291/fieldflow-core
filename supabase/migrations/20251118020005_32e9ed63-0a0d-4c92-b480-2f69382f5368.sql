-- Add formatted_address column to customer_locations table
ALTER TABLE customer_locations 
ADD COLUMN IF NOT EXISTS formatted_address TEXT;

COMMENT ON COLUMN customer_locations.formatted_address IS 'Standardized address returned from Google Geocoding API';