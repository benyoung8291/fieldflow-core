
-- Fix infinite recursion in user_roles RLS policies
-- Drop all problematic policies
DROP POLICY IF EXISTS "Super admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can create user roles" ON user_roles;
DROP POLICY IF EXISTS "Tenant admins can manage roles in their tenant" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create security definer function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = check_user_id
      AND role = 'super_admin'
  )
$$;

-- Create new policies using the security definer function
CREATE POLICY "Super admins can view all user roles"
ON user_roles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can create user roles"
ON user_roles
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage roles in their tenant"
ON user_roles
FOR ALL
USING (
  tenant_id = get_user_tenant_id() 
  AND has_role(auth.uid(), 'tenant_admin')
);

CREATE POLICY "Users can view their own roles"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);
