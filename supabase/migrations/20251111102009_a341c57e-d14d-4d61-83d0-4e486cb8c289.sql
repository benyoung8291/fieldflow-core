-- Add Microsoft Graph API columns to helpdesk_email_accounts
ALTER TABLE public.helpdesk_email_accounts
ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS microsoft_account_id TEXT;

-- Add index for token expiration checks
CREATE INDEX IF NOT EXISTS idx_helpdesk_email_accounts_token_expiry 
ON public.helpdesk_email_accounts(microsoft_token_expires_at) 
WHERE microsoft_token_expires_at IS NOT NULL;