-- Add policy to allow users to view chat-eligible profiles in their tenant
-- This fixes the "Unknown" user display bug in worker chat
CREATE POLICY "Users can view chat-eligible profiles in tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Must be in same tenant
  tenant_id = get_user_tenant_id_safe()
  AND
  -- Target user must have a non-customer role (chat-eligible)
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = profiles.id 
    AND ur.role NOT IN ('customer')
  )
);