-- URGENT: Remove the policy causing infinite recursion
DROP POLICY IF EXISTS "Users can view chat-eligible profiles in tenant" ON public.profiles;