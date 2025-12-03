-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can be added to channels" ON chat_channel_members;

-- Create updated INSERT policy that allows channel creators to add members
CREATE POLICY "Users can be added to channels" ON chat_channel_members
FOR INSERT
TO PUBLIC
WITH CHECK (
  (tenant_id = get_user_tenant_id_safe()) AND 
  (
    -- User can add themselves to public channels
    ((user_id = auth.uid()) AND is_public_channel(channel_id)) OR 
    -- User can add themselves to empty channels (first member)
    ((user_id = auth.uid()) AND channel_has_no_members(channel_id)) OR 
    -- Existing channel admins can add anyone
    is_channel_admin(channel_id, auth.uid()) OR
    -- Channel creator can add members
    (EXISTS (
      SELECT 1 FROM chat_channels 
      WHERE id = channel_id 
      AND created_by = auth.uid()
    ))
  )
);