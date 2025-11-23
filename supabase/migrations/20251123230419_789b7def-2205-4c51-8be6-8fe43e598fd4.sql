
-- Fix infinite recursion in profiles RLS policy
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Allow viewing profiles in same tenant" ON profiles;

-- Create a simpler policy that doesn't cause recursion
-- This allows users to view profiles in their tenant without checking user_roles
CREATE POLICY "Users can view profiles in their tenant"
ON profiles
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
