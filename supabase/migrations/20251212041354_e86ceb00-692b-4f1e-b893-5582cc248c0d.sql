-- Add description field to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS description text;

-- Add invoice terms and conditions to tenant_settings
ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS invoice_terms_conditions text;