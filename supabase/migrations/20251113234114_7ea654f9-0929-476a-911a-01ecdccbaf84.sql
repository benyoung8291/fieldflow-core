-- Remove problematic foreign key constraint
-- The tenant_id column in profiles is not unique, so we can't reference it with a foreign key
-- We'll rely on RLS policies for security instead
ALTER TABLE IF EXISTS general_settings 
  DROP CONSTRAINT IF EXISTS general_settings_tenant_id_fkey;