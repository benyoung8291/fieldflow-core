-- Add session_key column to oauth_temp_tokens for polling-based OAuth flow
ALTER TABLE public.oauth_temp_tokens 
ADD COLUMN IF NOT EXISTS session_key TEXT;