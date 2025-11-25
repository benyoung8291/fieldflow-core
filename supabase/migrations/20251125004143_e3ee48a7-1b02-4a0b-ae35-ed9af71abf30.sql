-- Fix RLS policies for user_roles table to ensure tenant admins can view and manage roles
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Allow users to view their own roles and admins to view all roles in tenant
CREATE POLICY "Users can view roles in their tenant"
ON user_roles
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id() OR
  user_id = auth.uid()
);

-- Allow admins and management to manage roles
CREATE POLICY "Admins and management can manage roles"
ON user_roles
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id() AND
  (
    has_role(auth.uid(), 'tenant_admin'::user_role) OR
    has_role(auth.uid(), 'management'::user_role)
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id() AND
  (
    has_role(auth.uid(), 'tenant_admin'::user_role) OR
    has_role(auth.uid(), 'management'::user_role)
  )
);

-- Fix RLS policies for role_permissions to ensure proper access
DROP POLICY IF EXISTS "Users can view permissions for their roles" ON role_permissions;
DROP POLICY IF EXISTS "Admins can manage all role permissions" ON role_permissions;

CREATE POLICY "Users can view permissions for their roles"
ON role_permissions
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins and management can manage role permissions"
ON role_permissions
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id() AND
  (
    has_role(auth.uid(), 'tenant_admin'::user_role) OR
    has_role(auth.uid(), 'management'::user_role)
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id() AND
  (
    has_role(auth.uid(), 'tenant_admin'::user_role) OR
    has_role(auth.uid(), 'management'::user_role)
  )
);

-- Update the has_role function to handle management role properly
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND tenant_id IN (
        SELECT tenant_id 
        FROM public.profiles 
        WHERE id = _user_id
      )
  )
$$;