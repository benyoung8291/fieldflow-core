-- Drop the problematic RLS policy causing infinite recursion
DROP POLICY IF EXISTS "Workers module viewers can see user roles" ON user_roles;

-- Create a SECURITY DEFINER function to check if user can view workers module
CREATE OR REPLACE FUNCTION public.can_view_workers_module(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.role_permissions rp ON ur.role = rp.role AND ur.tenant_id = rp.tenant_id
    WHERE ur.user_id = _user_id
    AND (
      -- Super admin or tenant admin have full access
      ur.role IN ('super_admin', 'tenant_admin')
      OR
      -- User has workers:view permission
      (rp.module = 'workers' AND rp.permission = 'view' AND rp.is_active = true)
    )
  );
$$;

-- Add correct RLS policy using the SECURITY DEFINER function
CREATE POLICY "Users with workers access can view user roles"
ON user_roles FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
  AND public.can_view_workers_module(auth.uid())
);