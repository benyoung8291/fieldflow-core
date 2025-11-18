-- Add archived field to customer_locations
ALTER TABLE customer_locations
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Add index for filtering archived locations
CREATE INDEX IF NOT EXISTS idx_customer_locations_archived 
ON customer_locations(customer_id, archived);

-- Add merged_into field to track merge history
ALTER TABLE customer_locations
ADD COLUMN IF NOT EXISTS merged_into_location_id UUID REFERENCES customer_locations(id) ON DELETE SET NULL;