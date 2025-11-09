-- Fix profiles table RLS policy to restrict access to sensitive employee data
-- Drop the existing policy that allows all users in tenant to view all profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

-- Create policy for users to view only their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Create policy for supervisors and admins to view all profiles in their tenant
CREATE POLICY "Supervisors and admins can view all profiles in tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id() 
  AND (has_role(auth.uid(), 'supervisor'::user_role) OR has_role(auth.uid(), 'tenant_admin'::user_role))
);