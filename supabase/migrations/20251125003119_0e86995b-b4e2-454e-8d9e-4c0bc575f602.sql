-- Enhance the role_permissions table to support more granular permissions
-- Add permission metadata for better control
ALTER TABLE role_permissions
ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create an index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup 
ON role_permissions(tenant_id, role, module, permission, is_active);

-- Create a function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_id_input uuid,
  module_input text,
  permission_input text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_perm boolean;
BEGIN
  -- Check if user is tenant_admin (has all permissions)
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = user_id_input 
    AND role = 'tenant_admin'
  ) INTO has_perm;
  
  IF has_perm THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role AND ur.tenant_id = rp.tenant_id
    WHERE ur.user_id = user_id_input 
    AND rp.module = module_input 
    AND rp.permission = permission_input
    AND rp.is_active = true
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$;

-- Create a function to get all user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id_input uuid)
RETURNS TABLE (
  module text,
  permission text,
  conditions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user is tenant_admin, return all permissions
  IF EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = user_id_input 
    AND role = 'tenant_admin'
  ) THEN
    RETURN QUERY
    SELECT 
      DISTINCT rp.module::text,
      rp.permission::text,
      '{}'::jsonb as conditions
    FROM role_permissions rp
    WHERE rp.is_active = true;
  ELSE
    -- Return user's specific permissions
    RETURN QUERY
    SELECT 
      DISTINCT rp.module::text,
      rp.permission::text,
      rp.conditions
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role AND ur.tenant_id = rp.tenant_id
    WHERE ur.user_id = user_id_input 
    AND rp.is_active = true;
  END IF;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.user_has_permission IS 'Check if a user has a specific permission for a module';
COMMENT ON FUNCTION public.get_user_permissions IS 'Get all permissions for a user';
COMMENT ON COLUMN role_permissions.conditions IS 'JSON object containing additional conditions for the permission';
COMMENT ON COLUMN role_permissions.description IS 'Human-readable description of what this permission allows';