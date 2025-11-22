
-- Drop the problematic unique constraint that prevents saving unpaired photos
ALTER TABLE field_report_photos 
DROP CONSTRAINT IF EXISTS unique_pair_constraint;

-- Add a better constraint that allows multiple unpaired photos
-- but prevents duplicate pairings (both directions)
ALTER TABLE field_report_photos
ADD CONSTRAINT unique_pair_constraint_one_way 
CHECK (
  paired_photo_id IS NULL OR 
  paired_photo_id > id
);
