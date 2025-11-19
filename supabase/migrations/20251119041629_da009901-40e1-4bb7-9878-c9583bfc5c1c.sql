-- Force PostgREST to reload schema cache
-- This ensures the schema cache reflects the current database structure
NOTIFY pgrst, 'reload schema';