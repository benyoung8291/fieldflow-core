-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;

-- Create a simpler policy that allows users to view profiles in their tenant
CREATE POLICY "Allow viewing profiles in same tenant"
ON profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles AS user_profile
    WHERE user_profile.id = auth.uid()
    AND user_profile.tenant_id = profiles.tenant_id
  )
);