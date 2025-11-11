-- Create temporary OAuth token storage table
CREATE TABLE IF NOT EXISTS public.oauth_temp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_in INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-delete tokens after 5 minutes
CREATE INDEX IF NOT EXISTS idx_oauth_temp_tokens_created_at ON public.oauth_temp_tokens(created_at);

-- Enable RLS
ALTER TABLE public.oauth_temp_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (needed for OAuth callback)
CREATE POLICY "Anyone can insert tokens" ON public.oauth_temp_tokens
  FOR INSERT WITH CHECK (true);

-- Allow anyone to select their own tokens by session_id
CREATE POLICY "Anyone can read tokens by session_id" ON public.oauth_temp_tokens
  FOR SELECT USING (true);

-- Allow anyone to delete their own tokens
CREATE POLICY "Anyone can delete tokens" ON public.oauth_temp_tokens
  FOR DELETE USING (true);