-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view accessible channels" ON chat_channels;

-- Create updated SELECT policy that includes channel creators
CREATE POLICY "Users can view accessible channels" ON chat_channels
FOR SELECT
TO PUBLIC
USING (
  (tenant_id = get_user_tenant_id_safe()) AND 
  (
    (type = 'public'::chat_channel_type) OR 
    is_channel_member(id, auth.uid()) OR 
    (created_by = auth.uid())
  )
);