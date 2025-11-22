
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles of workers with time logs in tenant" ON profiles;

-- Create a security definer function to check if a profile is a worker with time logs
CREATE OR REPLACE FUNCTION public.is_worker_with_time_logs(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM time_logs tl
    INNER JOIN profiles p ON p.id = auth.uid()
    WHERE tl.worker_id = _profile_id
      AND tl.tenant_id = p.tenant_id
  );
$$;

-- Create new policy using the security definer function
CREATE POLICY "Users can view profiles of workers with time logs in tenant"
ON profiles
FOR SELECT
USING (is_worker_with_time_logs(id));
