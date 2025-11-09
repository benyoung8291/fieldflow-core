-- Add company details columns to tenant_settings table
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_legal_name TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS abn TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Australia';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS secondary_color TEXT;