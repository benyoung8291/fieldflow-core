-- Drop existing problematic policies on user_roles
DROP POLICY IF EXISTS "Users can view profiles of workers with time logs in tenant" ON profiles;

-- Drop any existing policies on user_roles that might cause recursion
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON user_roles;

-- Create simple, non-recursive policy on user_roles
CREATE POLICY "Users can view their own roles"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Create a new security definer function that properly checks worker profiles
CREATE OR REPLACE FUNCTION public.can_view_worker_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if the requesting user is in the same tenant as the profile
  SELECT EXISTS (
    SELECT 1
    FROM profiles p1
    CROSS JOIN profiles p2
    WHERE p1.id = auth.uid()
      AND p2.id = _profile_id
      AND p1.tenant_id = p2.tenant_id
  );
$$;

-- Create policy for viewing worker profiles in same tenant
CREATE POLICY "Users can view profiles in their tenant"
ON profiles
FOR SELECT
USING (can_view_worker_profile(id));