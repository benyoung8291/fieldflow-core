-- Add ABN validation status column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS abn_validation_status text 
  CHECK (abn_validation_status IN ('pending', 'valid', 'invalid', 'needs_review'));