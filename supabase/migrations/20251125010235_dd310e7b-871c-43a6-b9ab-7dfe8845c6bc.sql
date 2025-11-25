
-- Fix infinite recursion in profiles table RLS policies
-- The issue: policies on profiles call has_role() which queries user_roles,
-- and user_roles policies call get_user_tenant_id() which queries profiles = infinite loop

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Supervisors and admins can view all profiles in tenant" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Users can view field report creator profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles of assigned workers" ON profiles;

-- Create new non-recursive policies

-- 1. Users can always view and update their own profile (no recursion)
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- 2. Users can view profiles in their tenant (direct subquery, no function calls)
CREATE POLICY "Users can view tenant profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT p.tenant_id 
    FROM profiles p 
    WHERE p.id = auth.uid()
  )
);

-- 3. Tenant admins and management can insert/update/delete profiles in their tenant
CREATE POLICY "Admins can manage tenant profiles"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('tenant_admin', 'management')
      AND ur.tenant_id = profiles.tenant_id
  )
);
