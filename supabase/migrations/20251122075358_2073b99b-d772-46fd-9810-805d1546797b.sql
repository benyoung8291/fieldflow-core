
-- Add policy to allow viewing worker profiles when viewing timesheets
CREATE POLICY "Users can view profiles of workers with time logs in tenant"
ON profiles
FOR SELECT
USING (
  id IN (
    SELECT DISTINCT worker_id
    FROM time_logs
    WHERE tenant_id = get_user_tenant_id()
  )
);
