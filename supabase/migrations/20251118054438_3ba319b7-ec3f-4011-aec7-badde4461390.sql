-- Simple notification to PostgREST
CREATE TABLE IF NOT EXISTS temp_reload_trigger_20251118 (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
DROP TABLE IF EXISTS temp_reload_trigger_20251118;

-- Send reload notifications
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';