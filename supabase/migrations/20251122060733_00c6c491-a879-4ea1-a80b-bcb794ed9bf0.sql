-- Migration: Encrypt sensitive credentials using Supabase Vault
-- This migration encrypts all plaintext credentials in accounting_integrations and helpdesk_email_accounts

-- Enable the vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Create a function to safely migrate credentials to vault
CREATE OR REPLACE FUNCTION migrate_credentials_to_vault()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  rec RECORD;
  secret_name TEXT;
BEGIN
  -- Migrate accounting_integrations credentials
  FOR rec IN 
    SELECT id, tenant_id, acumatica_username, acumatica_password, 
           xero_client_id, xero_client_secret, xero_refresh_token, xero_access_token
    FROM accounting_integrations
  LOOP
    -- Acumatica password
    IF rec.acumatica_password IS NOT NULL AND rec.acumatica_password != '' THEN
      secret_name := 'acumatica_password_' || rec.id::text;
      PERFORM vault.create_secret(rec.acumatica_password, secret_name);
      RAISE NOTICE 'Encrypted acumatica_password for integration %', rec.id;
    END IF;
    
    -- Xero client secret
    IF rec.xero_client_secret IS NOT NULL AND rec.xero_client_secret != '' THEN
      secret_name := 'xero_client_secret_' || rec.id::text;
      PERFORM vault.create_secret(rec.xero_client_secret, secret_name);
      RAISE NOTICE 'Encrypted xero_client_secret for integration %', rec.id;
    END IF;
    
    -- Xero refresh token
    IF rec.xero_refresh_token IS NOT NULL AND rec.xero_refresh_token != '' THEN
      secret_name := 'xero_refresh_token_' || rec.id::text;
      PERFORM vault.create_secret(rec.xero_refresh_token, secret_name);
      RAISE NOTICE 'Encrypted xero_refresh_token for integration %', rec.id;
    END IF;
    
    -- Xero access token
    IF rec.xero_access_token IS NOT NULL AND rec.xero_access_token != '' THEN
      secret_name := 'xero_access_token_' || rec.id::text;
      PERFORM vault.create_secret(rec.xero_access_token, secret_name);
      RAISE NOTICE 'Encrypted xero_access_token for integration %', rec.id;
    END IF;
  END LOOP;
  
  -- Migrate helpdesk_email_accounts credentials
  FOR rec IN 
    SELECT id, tenant_id, microsoft_client_secret, microsoft_refresh_token, microsoft_access_token
    FROM helpdesk_email_accounts
  LOOP
    -- Microsoft client secret
    IF rec.microsoft_client_secret IS NOT NULL AND rec.microsoft_client_secret != '' THEN
      secret_name := 'microsoft_client_secret_' || rec.id::text;
      PERFORM vault.create_secret(rec.microsoft_client_secret, secret_name);
      RAISE NOTICE 'Encrypted microsoft_client_secret for email account %', rec.id;
    END IF;
    
    -- Microsoft refresh token
    IF rec.microsoft_refresh_token IS NOT NULL AND rec.microsoft_refresh_token != '' THEN
      secret_name := 'microsoft_refresh_token_' || rec.id::text;
      PERFORM vault.create_secret(rec.microsoft_refresh_token, secret_name);
      RAISE NOTICE 'Encrypted microsoft_refresh_token for email account %', rec.id;
    END IF;
    
    -- Microsoft access token
    IF rec.microsoft_access_token IS NOT NULL AND rec.microsoft_access_token != '' THEN
      secret_name := 'microsoft_access_token_' || rec.id::text;
      PERFORM vault.create_secret(rec.microsoft_access_token, secret_name);
      RAISE NOTICE 'Encrypted microsoft_access_token for email account %', rec.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Credential migration to vault completed successfully';
END;
$$;

-- Run the migration
SELECT migrate_credentials_to_vault();

-- Clear plaintext credentials after encryption
UPDATE accounting_integrations 
SET 
  acumatica_password = CASE WHEN acumatica_password IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
  xero_client_secret = CASE WHEN xero_client_secret IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
  xero_refresh_token = CASE WHEN xero_refresh_token IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
  xero_access_token = CASE WHEN xero_access_token IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END;

UPDATE helpdesk_email_accounts
SET
  microsoft_client_secret = CASE WHEN microsoft_client_secret IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
  microsoft_refresh_token = CASE WHEN microsoft_refresh_token IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END,
  microsoft_access_token = CASE WHEN microsoft_access_token IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END;

-- Create helper functions for edge functions to decrypt credentials
CREATE OR REPLACE FUNCTION get_acumatica_password(integration_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = 'acumatica_password_' || integration_id::text;
  
  RETURN secret_value;
END;
$$;

CREATE OR REPLACE FUNCTION get_xero_credentials(integration_id UUID)
RETURNS TABLE(client_secret TEXT, refresh_token TEXT, access_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'xero_client_secret_' || integration_id::text),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'xero_refresh_token_' || integration_id::text),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'xero_access_token_' || integration_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION get_microsoft_credentials(email_account_id UUID)
RETURNS TABLE(client_secret TEXT, refresh_token TEXT, access_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'microsoft_client_secret_' || email_account_id::text),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'microsoft_refresh_token_' || email_account_id::text),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'microsoft_access_token_' || email_account_id::text);
END;
$$;

-- Create function to update encrypted credentials
CREATE OR REPLACE FUNCTION update_xero_tokens(
  integration_id UUID,
  new_access_token TEXT,
  new_refresh_token TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  -- Update access token
  PERFORM vault.update_secret(
    (SELECT id FROM vault.secrets WHERE name = 'xero_access_token_' || integration_id::text),
    new_access_token
  );
  
  -- Update refresh token if provided
  IF new_refresh_token IS NOT NULL THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'xero_refresh_token_' || integration_id::text),
      new_refresh_token
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION update_microsoft_tokens(
  email_account_id UUID,
  new_access_token TEXT,
  new_refresh_token TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  -- Update access token
  PERFORM vault.update_secret(
    (SELECT id FROM vault.secrets WHERE name = 'microsoft_access_token_' || email_account_id::text),
    new_access_token
  );
  
  -- Update refresh token if provided
  IF new_refresh_token IS NOT NULL THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'microsoft_refresh_token_' || email_account_id::text),
      new_refresh_token
    );
  END IF;
END;
$$;

-- Create function to store new Acumatica credentials
CREATE OR REPLACE FUNCTION store_acumatica_credentials(
  integration_id UUID,
  username TEXT,
  password TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_name TEXT;
  existing_secret_id UUID;
BEGIN
  secret_name := 'acumatica_password_' || integration_id::text;
  
  -- Check if secret already exists
  SELECT id INTO existing_secret_id
  FROM vault.secrets
  WHERE name = secret_name;
  
  IF existing_secret_id IS NOT NULL THEN
    -- Update existing secret
    PERFORM vault.update_secret(existing_secret_id, password);
  ELSE
    -- Create new secret
    PERFORM vault.create_secret(password, secret_name);
  END IF;
  
  -- Update username in plaintext (not sensitive)
  UPDATE accounting_integrations
  SET acumatica_username = username
  WHERE id = integration_id;
END;
$$;

COMMENT ON FUNCTION migrate_credentials_to_vault() IS 'One-time migration function to encrypt existing credentials';
COMMENT ON FUNCTION get_acumatica_password(UUID) IS 'Securely retrieve Acumatica password from vault';
COMMENT ON FUNCTION get_xero_credentials(UUID) IS 'Securely retrieve Xero credentials from vault';
COMMENT ON FUNCTION get_microsoft_credentials(UUID) IS 'Securely retrieve Microsoft credentials from vault';
COMMENT ON FUNCTION update_xero_tokens(UUID, TEXT, TEXT) IS 'Securely update Xero tokens in vault';
COMMENT ON FUNCTION update_microsoft_tokens(UUID, TEXT, TEXT) IS 'Securely update Microsoft tokens in vault';
COMMENT ON FUNCTION store_acumatica_credentials(UUID, TEXT, TEXT) IS 'Securely store Acumatica credentials in vault';