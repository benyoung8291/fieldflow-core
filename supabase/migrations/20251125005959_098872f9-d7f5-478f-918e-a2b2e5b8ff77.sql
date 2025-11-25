
-- Drop existing problematic policies and create simpler, more reliable ones
DROP POLICY IF EXISTS "Admins can view all roles in tenant" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles in tenant" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles in tenant" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON user_roles;
DROP POLICY IF EXISTS "Admins and management can manage roles" ON user_roles;

DROP POLICY IF EXISTS "Users can view permissions for their roles" ON role_permissions;
DROP POLICY IF EXISTS "Admins and management can manage role permissions" ON role_permissions;

-- Create simplified RLS policies for user_roles
-- Allow users to view their own roles
CREATE POLICY "Users can view own roles"
ON user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow tenant_admin and management to view all roles in their tenant
CREATE POLICY "Admins can view all tenant roles"
ON user_roles FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'management')
  )
);

-- Allow tenant_admin and management to insert roles in their tenant
CREATE POLICY "Admins can insert roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'management')
  )
);

-- Allow tenant_admin and management to update roles in their tenant  
CREATE POLICY "Admins can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'management')
  )
);

-- Allow tenant_admin and management to delete roles in their tenant
CREATE POLICY "Admins can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'management')
  )
);

-- Create simplified RLS policies for role_permissions
-- Allow all authenticated users to view permissions
CREATE POLICY "Users can view role permissions"
ON role_permissions FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Allow tenant_admin and management to manage permissions
CREATE POLICY "Admins can manage permissions"
ON role_permissions FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'management')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('tenant_admin', 'management')
  )
);
