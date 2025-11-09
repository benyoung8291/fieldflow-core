-- Add latitude and longitude to customer_locations table
ALTER TABLE public.customer_locations
ADD COLUMN latitude NUMERIC(10, 8),
ADD COLUMN longitude NUMERIC(11, 8);

COMMENT ON COLUMN public.customer_locations.latitude IS 'Latitude coordinate for location mapping';
COMMENT ON COLUMN public.customer_locations.longitude IS 'Longitude coordinate for location mapping';