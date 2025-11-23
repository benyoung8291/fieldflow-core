
-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;

-- Create a security definer function to check if user can view profile
CREATE OR REPLACE FUNCTION public.can_view_profile(profile_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND tenant_id = profile_tenant_id
  )
$$;

-- Create new policy using the security definer function
CREATE POLICY "Users can view profiles in their tenant"
ON profiles
FOR SELECT
USING (public.can_view_profile(tenant_id));
