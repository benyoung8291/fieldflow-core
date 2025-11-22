-- Add a development-friendly policy for timesheets
-- This allows authenticated users to view all timesheets if they don't have a tenant_id yet
-- In production, you'd want to ensure all users have proper tenant_id set

DROP POLICY IF EXISTS "Users can view timesheets in their tenant" ON timesheets;

CREATE POLICY "Users can view timesheets in their tenant" 
ON timesheets 
FOR SELECT 
USING (
  -- Allow if tenant matches OR if user has no tenant (development scenario)
  tenant_id = get_user_tenant_id() 
  OR get_user_tenant_id() IS NULL
);

-- Also ensure time_logs have similar flexibility
DROP POLICY IF EXISTS "Users can view time logs in their tenant" ON time_logs;

CREATE POLICY "Users can view time logs in their tenant"
ON time_logs
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  OR get_user_tenant_id() IS NULL
);