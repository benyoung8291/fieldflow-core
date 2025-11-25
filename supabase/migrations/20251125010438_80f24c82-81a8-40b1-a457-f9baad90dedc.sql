
-- Create security definer functions that bypass RLS to prevent infinite recursion

-- Function to get user's tenant_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_tenant_id_safe()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Function to check if user has specific role without RLS recursion
CREATE OR REPLACE FUNCTION public.user_has_role_safe(check_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = check_role
  );
$$;

-- Function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION public.user_has_any_role_safe(check_roles user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY(check_roles)
  );
$$;

-- Now fix profiles policies to use these functions
DROP POLICY IF EXISTS "Users can view tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage tenant profiles" ON profiles;

-- Users can view profiles in their tenant (using security definer function)
CREATE POLICY "Users can view tenant profiles"
ON profiles FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id_safe());

-- Admins and management can manage all profiles in their tenant
CREATE POLICY "Admins can manage tenant profiles"
ON profiles FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe()
  AND user_has_any_role_safe(ARRAY['tenant_admin', 'management']::user_role[])
)
WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND user_has_any_role_safe(ARRAY['tenant_admin', 'management']::user_role[])
);

-- Also fix user_roles policies to avoid self-referential queries
DROP POLICY IF EXISTS "Admins can view all tenant roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Recreate user_roles policies using security definer functions
CREATE POLICY "Admins can view all tenant roles"
ON user_roles FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe()
  AND user_has_any_role_safe(ARRAY['tenant_admin', 'management']::user_role[])
);

CREATE POLICY "Admins can insert roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND user_has_any_role_safe(ARRAY['tenant_admin', 'management']::user_role[])
);

CREATE POLICY "Admins can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe()
  AND user_has_any_role_safe(ARRAY['tenant_admin', 'management']::user_role[])
);

CREATE POLICY "Admins can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id_safe()
  AND user_has_any_role_safe(ARRAY['tenant_admin', 'management']::user_role[])
);
