-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_microsoft_credentials(UUID);
DROP FUNCTION IF EXISTS public.update_microsoft_tokens(UUID, TEXT, TEXT);

-- Create RPC function to get Microsoft credentials from vault for helpdesk email accounts
CREATE OR REPLACE FUNCTION public.get_microsoft_credentials(email_account_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'access_token', microsoft_access_token,
    'refresh_token', microsoft_refresh_token,
    'client_secret', microsoft_client_secret
  ) INTO result
  FROM helpdesk_email_accounts
  WHERE id = email_account_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to update Microsoft tokens after refresh
CREATE OR REPLACE FUNCTION public.update_microsoft_tokens(
  email_account_id UUID,
  new_access_token TEXT,
  new_refresh_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE helpdesk_email_accounts
  SET 
    microsoft_access_token = new_access_token,
    microsoft_refresh_token = new_refresh_token,
    updated_at = NOW()
  WHERE id = email_account_id;
END;
$$;