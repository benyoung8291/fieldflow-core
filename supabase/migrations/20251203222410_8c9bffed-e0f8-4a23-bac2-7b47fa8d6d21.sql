-- First, clean up orphaned DM channels with no members
DELETE FROM chat_channels 
WHERE type = 'dm' 
AND id NOT IN (SELECT DISTINCT channel_id FROM chat_channel_members);

-- Drop the existing INSERT policy on chat_channel_members
DROP POLICY IF EXISTS "Users can join public channels or be added by admins" ON public.chat_channel_members;

-- Create updated INSERT policy that allows channel creators to add initial members
CREATE POLICY "Users can join public channels or be added by admins or creators"
  ON public.chat_channel_members FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id_safe() AND (
      -- User can add themselves to public channels
      (user_id = auth.uid() AND is_public_channel(channel_id))
      OR
      -- Channel admins/owners can add members
      is_channel_admin(channel_id, auth.uid())
      OR
      -- Channel creator can add initial members (for new DM channels)
      EXISTS (
        SELECT 1 FROM public.chat_channels
        WHERE id = channel_id
          AND created_by = auth.uid()
          AND tenant_id = get_user_tenant_id_safe()
      )
      OR
      -- Allow first members to be added to empty channels (handles race condition)
      channel_has_no_members(channel_id)
    )
  );