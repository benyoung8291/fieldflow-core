-- Force complete types regeneration for suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS _types_sync_trigger text DEFAULT NULL;
ALTER TABLE suppliers DROP COLUMN IF EXISTS _types_sync_trigger;