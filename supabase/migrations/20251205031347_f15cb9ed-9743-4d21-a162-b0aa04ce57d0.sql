-- Update the store_acumatica_credentials function to also set the [ENCRYPTED] marker
CREATE OR REPLACE FUNCTION public.store_acumatica_credentials(integration_id uuid, username text, password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
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
  
  -- Update username in plaintext and set password marker to indicate encrypted storage
  UPDATE accounting_integrations
  SET 
    acumatica_username = username,
    acumatica_password = '[ENCRYPTED]'
  WHERE id = integration_id;
END;
$function$;

-- Fix any existing records that have credentials in vault but missing the marker
UPDATE accounting_integrations
SET acumatica_password = '[ENCRYPTED]'
WHERE provider = 'myob_acumatica'
  AND acumatica_username IS NOT NULL
  AND acumatica_username != ''
  AND (acumatica_password IS NULL OR acumatica_password != '[ENCRYPTED]');