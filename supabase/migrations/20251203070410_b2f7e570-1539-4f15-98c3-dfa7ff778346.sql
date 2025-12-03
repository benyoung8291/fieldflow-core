-- Drop duplicate RLS policy on chat_channels
DROP POLICY IF EXISTS "Authenticated users can create channels in their tenant" ON public.chat_channels;