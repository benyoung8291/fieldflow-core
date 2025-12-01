-- Create function to check if user is supervisor or above
CREATE OR REPLACE FUNCTION public.is_supervisor_or_above(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
    AND role IN ('supervisor', 'tenant_admin', 'super_admin', 'management')
  );
$$;

-- Drop existing overly permissive policies on appointments
DROP POLICY IF EXISTS "Users can view appointments in their tenant" ON appointments;
DROP POLICY IF EXISTS "Workers can view appointments in their tenant" ON appointments;

-- Create tighter RLS policy for appointments - workers only see assigned appointments
CREATE POLICY "Workers can view assigned appointments"
ON appointments FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id() AND (
    -- Supervisors/admins see all in tenant
    is_supervisor_or_above(auth.uid())
    OR
    -- Workers only see appointments they are assigned to
    EXISTS (
      SELECT 1 FROM appointment_workers 
      WHERE appointment_id = appointments.id 
      AND worker_id = auth.uid()
    )
  )
);

-- Drop existing overly permissive policies on tasks
DROP POLICY IF EXISTS "Users can view tasks in their tenant" ON tasks;
DROP POLICY IF EXISTS "Workers can view tasks in their tenant" ON tasks;

-- Create tighter RLS policy for tasks - workers only see assigned tasks
CREATE POLICY "Workers can view assigned tasks"
ON tasks FOR SELECT  
TO authenticated
USING (
  tenant_id = get_user_tenant_id() AND (
    -- Supervisors/admins see all in tenant
    is_supervisor_or_above(auth.uid())
    OR
    -- Workers only see tasks assigned to them
    assigned_to = auth.uid()
    OR
    -- Or tasks they created
    created_by = auth.uid()
  )
);