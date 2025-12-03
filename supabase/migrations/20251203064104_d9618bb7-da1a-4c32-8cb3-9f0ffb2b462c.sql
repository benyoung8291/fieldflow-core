-- Clean up duplicate RLS policies on chat tables

-- Drop duplicate policies on chat_channels
DROP POLICY IF EXISTS "Users can create channels in their tenant" ON chat_channels;

-- Drop duplicate policies on chat_messages
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can edit own messages" ON chat_messages;