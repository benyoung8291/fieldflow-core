-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move uuid-ossp extension to extensions schema (preserves all dependencies)
ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;

-- Grant usage on extensions schema to relevant roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;