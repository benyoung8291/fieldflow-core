-- Add category field to appointment_attachments to distinguish between before photos and documents
ALTER TABLE appointment_attachments 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'before_photo' CHECK (category IN ('before_photo', 'document'));

-- Update existing records to be before_photo
UPDATE appointment_attachments 
SET category = 'before_photo' 
WHERE category IS NULL;