-- Add image_url column to floor_plans table for storing converted PDF images
ALTER TABLE floor_plans 
ADD COLUMN image_url TEXT;

COMMENT ON COLUMN floor_plans.image_url IS 'URL to the converted image version of the floor plan (for faster loading of PDFs)';
