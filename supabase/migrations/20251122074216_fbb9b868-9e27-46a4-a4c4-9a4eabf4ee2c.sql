-- Add super_admin role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Add billing and subscription fields to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10,2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update RLS policies to allow super_admins to view all tenants
DROP POLICY IF EXISTS "Super admins can view all tenants" ON tenants;
CREATE POLICY "Super admins can view all tenants"
ON tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Allow super_admins to insert tenants
DROP POLICY IF EXISTS "Super admins can create tenants" ON tenants;
CREATE POLICY "Super admins can create tenants"
ON tenants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Allow super_admins to update tenants
DROP POLICY IF EXISTS "Super admins can update tenants" ON tenants;
CREATE POLICY "Super admins can update tenants"
ON tenants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Allow super_admins to view all profiles across tenants
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles"
ON profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Allow super_admins to view all user_roles
DROP POLICY IF EXISTS "Super admins can view all user roles" ON user_roles;
CREATE POLICY "Super admins can view all user roles"
ON user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

-- Allow super_admins to insert user_roles
DROP POLICY IF EXISTS "Super admins can create user roles" ON user_roles;
CREATE POLICY "Super admins can create user roles"
ON user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);