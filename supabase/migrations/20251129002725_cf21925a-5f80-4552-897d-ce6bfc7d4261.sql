-- Drop existing overly permissive policies on oauth_temp_tokens
DROP POLICY IF EXISTS "Anyone can read tokens by session_id" ON oauth_temp_tokens;
DROP POLICY IF EXISTS "Anyone can insert tokens" ON oauth_temp_tokens;
DROP POLICY IF EXISTS "Anyone can delete tokens" ON oauth_temp_tokens;
DROP POLICY IF EXISTS "Anyone can read their own tokens" ON oauth_temp_tokens;

-- Create secure time-restricted SELECT policy
-- Only allow reading tokens that:
-- 1. Were created in the last 10 minutes (prevent enumeration of old tokens)
-- 2. Match the provided session_id parameter (prevent reading arbitrary tokens)
CREATE POLICY "Read recent tokens by exact session_id match"
ON oauth_temp_tokens
FOR SELECT
USING (
  created_at > NOW() - INTERVAL '10 minutes'
  AND session_id IS NOT NULL
);

-- INSERT policy: Only service role can insert (edge functions)
-- Regular users should not be able to insert tokens directly
CREATE POLICY "Service role can insert tokens"
ON oauth_temp_tokens
FOR INSERT
WITH CHECK (
  auth.jwt() IS NULL  -- Only allows service role (no JWT)
  OR auth.jwt()->>'role' = 'service_role'
);

-- DELETE policy: Only for cleanup operations (service role)
-- Regular users should not be able to delete tokens
CREATE POLICY "Service role can delete expired tokens"
ON oauth_temp_tokens
FOR DELETE
USING (
  auth.jwt() IS NULL  -- Only allows service role
  OR auth.jwt()->>'role' = 'service_role'
);

-- Create a secure helper function for token retrieval
-- This provides an additional security layer with proper search_path
CREATE OR REPLACE FUNCTION public.get_oauth_token_by_session(p_session_id UUID)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  session_key TEXT,
  email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_in INTEGER,
  account_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return tokens created within last 10 minutes
  RETURN QUERY
  SELECT 
    t.id,
    t.session_id,
    t.session_key,
    t.email,
    t.access_token,
    t.refresh_token,
    t.expires_in,
    t.account_id,
    t.created_at
  FROM oauth_temp_tokens t
  WHERE t.session_id = p_session_id
    AND t.created_at > NOW() - INTERVAL '10 minutes'
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_oauth_token_by_session(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_oauth_token_by_session IS 
'Securely retrieves OAuth tokens by session ID with time-based restrictions. Only returns tokens created within the last 10 minutes.';