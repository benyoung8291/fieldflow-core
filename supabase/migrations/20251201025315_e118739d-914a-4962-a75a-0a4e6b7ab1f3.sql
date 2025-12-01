-- Allow users with workers:view permission to view user_roles in their tenant
-- This fixes supervisors being unable to see the Workers page
CREATE POLICY "Workers module viewers can see user roles"
ON user_roles FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
  AND (
    -- Allow if user is tenant_admin
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'tenant_admin'
      AND ur.tenant_id = user_roles.tenant_id
    )
    OR
    -- Allow if user has workers:view permission
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role = rp.role AND ur.tenant_id = rp.tenant_id
      WHERE ur.user_id = auth.uid()
      AND rp.module = 'workers'
      AND rp.permission = 'view'
      AND rp.is_active = true
      AND ur.tenant_id = user_roles.tenant_id
    )
  )
);