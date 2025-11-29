-- Create a secure helper function for token retrieval by session_key (used for polling flow)
CREATE OR REPLACE FUNCTION public.get_oauth_token_by_key(p_session_key TEXT)
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
  WHERE t.session_key = p_session_key
    AND t.created_at > NOW() - INTERVAL '10 minutes'
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_oauth_token_by_key(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_oauth_token_by_key IS 
'Securely retrieves OAuth tokens by session key (for polling flow) with time-based restrictions. Only returns tokens created within the last 10 minutes.';