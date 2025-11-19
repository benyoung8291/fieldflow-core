-- Add Acumatica username and password fields to accounting_integrations table
ALTER TABLE public.accounting_integrations
ADD COLUMN IF NOT EXISTS acumatica_username TEXT,
ADD COLUMN IF NOT EXISTS acumatica_password TEXT;