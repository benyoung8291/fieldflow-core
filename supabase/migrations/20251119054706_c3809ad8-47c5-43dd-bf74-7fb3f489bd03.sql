-- Add Xero OAuth token fields to accounting_integrations table
ALTER TABLE public.accounting_integrations
ADD COLUMN IF NOT EXISTS xero_client_id TEXT,
ADD COLUMN IF NOT EXISTS xero_client_secret TEXT,
ADD COLUMN IF NOT EXISTS xero_access_token TEXT,
ADD COLUMN IF NOT EXISTS xero_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS xero_token_expires_at TIMESTAMPTZ;