-- Fix RLS policies for user_roles and role_permissions to allow proper access

-- Drop ALL existing policies on user_roles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'user_roles'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_roles';
    END LOOP;
END $$;

-- Drop ALL existing policies on role_permissions
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'role_permissions'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON role_permissions';
    END LOOP;
END $$;

-- Create comprehensive RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles in tenant"
ON user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = user_roles.tenant_id
  )
);

CREATE POLICY "Admins can insert roles in tenant"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = user_roles.tenant_id
  )
);

CREATE POLICY "Admins can delete roles in tenant"
ON user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = user_roles.tenant_id
  )
);

-- Create RLS policies for role_permissions
CREATE POLICY "Users can view permissions for their roles"
ON role_permissions
FOR SELECT
TO authenticated
USING (
  role IN (
    SELECT ur.role FROM user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);

-- Create function to terminate all sessions for a user
CREATE OR REPLACE FUNCTION public.terminate_user_sessions(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all sessions for the user from auth.sessions
  DELETE FROM auth.sessions
  WHERE user_id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.terminate_user_sessions(uuid) TO authenticated;

-- Add RLS policy to control who can terminate sessions
CREATE OR REPLACE FUNCTION public.can_manage_user(target_user_id uuid, target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user is a tenant admin in the target tenant
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'tenant_admin'
    AND ur.tenant_id = target_tenant_id
  );
END;
$$;

-- Add comment explaining the security model
COMMENT ON FUNCTION public.terminate_user_sessions IS 
'Terminates all active sessions for a user. Should only be called by tenant admins through proper authorization checks.';

COMMENT ON FUNCTION public.can_manage_user IS 
'Checks if the current user has permission to manage the target user within their tenant.';