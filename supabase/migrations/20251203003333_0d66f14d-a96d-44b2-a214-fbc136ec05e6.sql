-- Chat Module Schema Migration
-- Phase 1: Database schema for Slack-quality chat functionality

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE chat_channel_type AS ENUM ('public', 'private', 'dm', 'context');
CREATE TYPE chat_member_role AS ENUM ('owner', 'admin', 'member');

-- =====================================================
-- TABLE: chat_channels
-- =====================================================

CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT, -- Nullable for DMs
  type chat_channel_type NOT NULL DEFAULT 'public',
  description TEXT,
  context_id UUID, -- ID of Project, Service Order, etc.
  context_type TEXT, -- 'project', 'service_order', etc.
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for chat_channels
CREATE INDEX idx_chat_channels_tenant_id ON public.chat_channels(tenant_id);
CREATE INDEX idx_chat_channels_type ON public.chat_channels(tenant_id, type);
CREATE INDEX idx_chat_channels_context ON public.chat_channels(tenant_id, context_type, context_id) WHERE context_id IS NOT NULL;
CREATE INDEX idx_chat_channels_last_message ON public.chat_channels(tenant_id, last_message_at DESC NULLS LAST);

-- =====================================================
-- TABLE: chat_channel_members
-- =====================================================

CREATE TABLE public.chat_channel_members (
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role chat_member_role NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- Indexes for chat_channel_members
CREATE INDEX idx_chat_channel_members_user ON public.chat_channel_members(user_id);
CREATE INDEX idx_chat_channel_members_tenant ON public.chat_channel_members(tenant_id);

-- =====================================================
-- TABLE: chat_messages
-- =====================================================

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for chat_messages
CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_chat_messages_tenant ON public.chat_messages(tenant_id);
CREATE INDEX idx_chat_messages_reply ON public.chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_not_deleted ON public.chat_messages(channel_id, created_at DESC) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE: chat_attachments
-- =====================================================

CREATE TABLE public.chat_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for chat_attachments
CREATE INDEX idx_chat_attachments_message ON public.chat_attachments(message_id);
CREATE INDEX idx_chat_attachments_tenant ON public.chat_attachments(tenant_id);

-- =====================================================
-- TABLE: chat_reactions
-- =====================================================

CREATE TABLE public.chat_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji) -- One reaction per emoji per user per message
);

-- Indexes for chat_reactions
CREATE INDEX idx_chat_reactions_message ON public.chat_reactions(message_id);
CREATE INDEX idx_chat_reactions_tenant ON public.chat_reactions(tenant_id);

-- =====================================================
-- TRIGGERS: Auto-update updated_at
-- =====================================================

CREATE TRIGGER update_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRIGGER: Update last_message_at on channel when message sent
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_channel_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_channels
  SET last_message_at = NEW.created_at
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_channel_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_channel_last_message_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS: chat_channels
-- =====================================================

-- SELECT: Can view public channels in tenant OR channels they're a member of
CREATE POLICY "Users can view accessible channels"
  ON public.chat_channels FOR SELECT
  USING (
    tenant_id = get_user_tenant_id() AND (
      type = 'public' OR
      EXISTS (
        SELECT 1 FROM public.chat_channel_members
        WHERE channel_id = chat_channels.id AND user_id = auth.uid()
      )
    )
  );

-- INSERT: Can create channels in their tenant
CREATE POLICY "Users can create channels in their tenant"
  ON public.chat_channels FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() AND
    created_by = auth.uid()
  );

-- UPDATE: Only channel owner/admin can update
CREATE POLICY "Channel owners and admins can update"
  ON public.chat_channels FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_channel_members
      WHERE channel_id = chat_channels.id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- DELETE: Only channel owner can delete
CREATE POLICY "Channel owners can delete"
  ON public.chat_channels FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_channel_members
      WHERE channel_id = chat_channels.id 
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- =====================================================
-- RLS: chat_channel_members
-- =====================================================

-- SELECT: Can view members of channels they can access
CREATE POLICY "Users can view members of accessible channels"
  ON public.chat_channel_members FOR SELECT
  USING (
    tenant_id = get_user_tenant_id() AND (
      -- They are the member being viewed
      user_id = auth.uid() OR
      -- They have access to the channel
      EXISTS (
        SELECT 1 FROM public.chat_channels c
        WHERE c.id = chat_channel_members.channel_id
          AND c.tenant_id = get_user_tenant_id()
          AND (
            c.type = 'public' OR
            EXISTS (
              SELECT 1 FROM public.chat_channel_members m
              WHERE m.channel_id = c.id AND m.user_id = auth.uid()
            )
          )
      )
    )
  );

-- INSERT: Channel owner/admin can add members OR user joins public channel
CREATE POLICY "Users can be added to channels"
  ON public.chat_channel_members FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() AND (
      -- User is adding themselves to a public channel
      (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.chat_channels
          WHERE id = chat_channel_members.channel_id
            AND tenant_id = get_user_tenant_id()
            AND type = 'public'
        )
      ) OR
      -- Owner/admin is adding someone
      EXISTS (
        SELECT 1 FROM public.chat_channel_members existing
        WHERE existing.channel_id = chat_channel_members.channel_id
          AND existing.user_id = auth.uid()
          AND existing.role IN ('owner', 'admin')
      )
    )
  );

-- UPDATE: Users can update their own membership (last_read, notifications)
CREATE POLICY "Users can update own membership"
  ON public.chat_channel_members FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() AND
    user_id = auth.uid()
  );

-- DELETE: User can leave OR owner/admin can remove
CREATE POLICY "Users can leave or be removed from channels"
  ON public.chat_channel_members FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND (
      -- User leaving
      user_id = auth.uid() OR
      -- Owner/admin removing
      EXISTS (
        SELECT 1 FROM public.chat_channel_members existing
        WHERE existing.channel_id = chat_channel_members.channel_id
          AND existing.user_id = auth.uid()
          AND existing.role IN ('owner', 'admin')
      )
    )
  );

-- =====================================================
-- RLS: chat_messages
-- =====================================================

-- SELECT: Can view messages in channels they have access to
CREATE POLICY "Users can view messages in accessible channels"
  ON public.chat_messages FOR SELECT
  USING (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = chat_messages.channel_id
        AND c.tenant_id = get_user_tenant_id()
        AND (
          c.type = 'public' OR
          EXISTS (
            SELECT 1 FROM public.chat_channel_members m
            WHERE m.channel_id = c.id AND m.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: Can only send messages to channels they're a member of
CREATE POLICY "Members can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() AND
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_channel_members
      WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid()
    )
  );

-- UPDATE: Can only edit own messages
CREATE POLICY "Users can edit own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() AND
    user_id = auth.uid()
  );

-- DELETE: Can soft-delete own messages
CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND
    user_id = auth.uid()
  );

-- =====================================================
-- RLS: chat_attachments
-- =====================================================

-- SELECT: Can view attachments of messages they can see
CREATE POLICY "Users can view attachments of visible messages"
  ON public.chat_attachments FOR SELECT
  USING (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_channels c ON c.id = m.channel_id
      WHERE m.id = chat_attachments.message_id
        AND c.tenant_id = get_user_tenant_id()
        AND (
          c.type = 'public' OR
          EXISTS (
            SELECT 1 FROM public.chat_channel_members mem
            WHERE mem.channel_id = c.id AND mem.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: Can add attachments to own messages
CREATE POLICY "Users can add attachments to own messages"
  ON public.chat_attachments FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE id = chat_attachments.message_id AND user_id = auth.uid()
    )
  );

-- DELETE: Can delete own attachments
CREATE POLICY "Users can delete own attachments"
  ON public.chat_attachments FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE id = chat_attachments.message_id AND user_id = auth.uid()
    )
  );

-- =====================================================
-- RLS: chat_reactions
-- =====================================================

-- SELECT: Can view reactions on messages they can see
CREATE POLICY "Users can view reactions on visible messages"
  ON public.chat_reactions FOR SELECT
  USING (
    tenant_id = get_user_tenant_id() AND
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_channels c ON c.id = m.channel_id
      WHERE m.id = chat_reactions.message_id
        AND c.tenant_id = get_user_tenant_id()
        AND (
          c.type = 'public' OR
          EXISTS (
            SELECT 1 FROM public.chat_channel_members mem
            WHERE mem.channel_id = c.id AND mem.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: Can react to messages in channels they're a member of
CREATE POLICY "Members can add reactions"
  ON public.chat_reactions FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() AND
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_channel_members mem ON mem.channel_id = m.channel_id
      WHERE m.id = chat_reactions.message_id AND mem.user_id = auth.uid()
    )
  );

-- DELETE: Can remove own reactions
CREATE POLICY "Users can remove own reactions"
  ON public.chat_reactions FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND
    user_id = auth.uid()
  );

-- =====================================================
-- ENABLE REALTIME for chat_messages
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;