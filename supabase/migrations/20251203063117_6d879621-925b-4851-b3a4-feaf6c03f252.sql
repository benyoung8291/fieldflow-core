-- Step 1: Create helper functions (SECURITY DEFINER) to break circular references

-- Function to check if user is member of a channel
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = p_channel_id 
    AND user_id = p_user_id
  );
$$;

-- Function to check if user is owner/admin of a channel
CREATE OR REPLACE FUNCTION public.is_channel_admin(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = p_channel_id 
    AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
$$;

-- Function to check if user is owner of a channel
CREATE OR REPLACE FUNCTION public.is_channel_owner(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = p_channel_id 
    AND user_id = p_user_id
    AND role = 'owner'
  );
$$;

-- Function to check if channel is public
CREATE OR REPLACE FUNCTION public.is_public_channel(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channels
    WHERE id = p_channel_id 
    AND type = 'public'
  );
$$;

-- Function to check if channel has no members yet (for first member join)
CREATE OR REPLACE FUNCTION public.channel_has_no_members(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = p_channel_id
  );
$$;

-- Step 2: Drop and recreate chat_channel_members policies

DROP POLICY IF EXISTS "Users can view members of accessible channels" ON chat_channel_members;
CREATE POLICY "Users can view members of accessible channels" ON chat_channel_members
FOR SELECT USING (
  tenant_id = get_user_tenant_id_safe()
  AND (
    user_id = auth.uid()
    OR is_public_channel(channel_id)
    OR is_channel_member(channel_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can be added to channels" ON chat_channel_members;
CREATE POLICY "Users can be added to channels" ON chat_channel_members
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND (
    -- User joining themselves to public channel
    (user_id = auth.uid() AND is_public_channel(channel_id))
    -- User joining themselves as creator (channel has no members yet)
    OR (user_id = auth.uid() AND channel_has_no_members(channel_id))
    -- Owner/admin adding another user
    OR is_channel_admin(channel_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can leave or be removed from channels" ON chat_channel_members;
CREATE POLICY "Users can leave or be removed from channels" ON chat_channel_members
FOR DELETE USING (
  tenant_id = get_user_tenant_id_safe()
  AND (
    user_id = auth.uid()
    OR is_channel_admin(channel_id, auth.uid())
  )
);

-- Step 3: Drop and recreate chat_channels policies

DROP POLICY IF EXISTS "Users can view accessible channels" ON chat_channels;
CREATE POLICY "Users can view accessible channels" ON chat_channels
FOR SELECT USING (
  tenant_id = get_user_tenant_id_safe()
  AND (
    type = 'public'
    OR is_channel_member(id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can create channels" ON chat_channels;
CREATE POLICY "Authenticated users can create channels" ON chat_channels
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Channel owners and admins can update" ON chat_channels;
CREATE POLICY "Channel owners and admins can update" ON chat_channels
FOR UPDATE USING (
  tenant_id = get_user_tenant_id_safe()
  AND is_channel_admin(id, auth.uid())
);

DROP POLICY IF EXISTS "Channel owners can delete" ON chat_channels;
CREATE POLICY "Channel owners can delete" ON chat_channels
FOR DELETE USING (
  tenant_id = get_user_tenant_id_safe()
  AND is_channel_owner(id, auth.uid())
);

-- Step 4: Drop and recreate chat_messages policies

DROP POLICY IF EXISTS "Users can view messages in accessible channels" ON chat_messages;
CREATE POLICY "Users can view messages in accessible channels" ON chat_messages
FOR SELECT USING (
  tenant_id = get_user_tenant_id_safe()
  AND (
    is_public_channel(channel_id)
    OR is_channel_member(channel_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Members can send messages" ON chat_messages;
CREATE POLICY "Members can send messages" ON chat_messages
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND user_id = auth.uid()
  AND is_channel_member(channel_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
CREATE POLICY "Users can update their own messages" ON chat_messages
FOR UPDATE USING (
  tenant_id = get_user_tenant_id_safe()
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;
CREATE POLICY "Users can delete their own messages" ON chat_messages
FOR DELETE USING (
  tenant_id = get_user_tenant_id_safe()
  AND (
    user_id = auth.uid()
    OR is_channel_admin(channel_id, auth.uid())
  )
);

-- Step 5: Fix chat_attachments and chat_reactions policies

DROP POLICY IF EXISTS "Users can view attachments in accessible channels" ON chat_attachments;
CREATE POLICY "Users can view attachments in accessible channels" ON chat_attachments
FOR SELECT USING (
  tenant_id = get_user_tenant_id_safe()
  AND EXISTS (
    SELECT 1 FROM chat_messages m
    WHERE m.id = message_id
    AND (is_public_channel(m.channel_id) OR is_channel_member(m.channel_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Members can add attachments" ON chat_attachments;
CREATE POLICY "Members can add attachments" ON chat_attachments
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND EXISTS (
    SELECT 1 FROM chat_messages m
    WHERE m.id = message_id
    AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view reactions in accessible channels" ON chat_reactions;
CREATE POLICY "Users can view reactions in accessible channels" ON chat_reactions
FOR SELECT USING (
  tenant_id = get_user_tenant_id_safe()
  AND EXISTS (
    SELECT 1 FROM chat_messages m
    WHERE m.id = message_id
    AND (is_public_channel(m.channel_id) OR is_channel_member(m.channel_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Members can add reactions" ON chat_reactions;
CREATE POLICY "Members can add reactions" ON chat_reactions
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id_safe()
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM chat_messages m
    WHERE m.id = message_id
    AND is_channel_member(m.channel_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can remove their own reactions" ON chat_reactions;
CREATE POLICY "Users can remove their own reactions" ON chat_reactions
FOR DELETE USING (
  tenant_id = get_user_tenant_id_safe()
  AND user_id = auth.uid()
);