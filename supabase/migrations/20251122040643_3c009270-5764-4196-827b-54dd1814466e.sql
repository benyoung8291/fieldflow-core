-- Enable RLS on time_logs table
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Workers can view their own time logs
CREATE POLICY "Workers can view their own time logs"
ON time_logs
FOR SELECT
TO authenticated
USING (
  auth.uid() = worker_id
);

-- Policy: Workers can insert their own time logs
CREATE POLICY "Workers can insert their own time logs"
ON time_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = worker_id
);

-- Policy: Workers can update their own time logs
CREATE POLICY "Workers can update their own time logs"
ON time_logs
FOR UPDATE
TO authenticated
USING (
  auth.uid() = worker_id
)
WITH CHECK (
  auth.uid() = worker_id
);

-- Policy: Admins and supervisors can view all time logs
CREATE POLICY "Admins can view all time logs"
ON time_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'tenant_admin', 'supervisor')
  )
);

-- Policy: Admins can update all time logs
CREATE POLICY "Admins can update all time logs"
ON time_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'tenant_admin', 'supervisor')
  )
);