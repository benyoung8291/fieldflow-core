-- Create workers view if it doesn't exist (combines profiles with worker-specific data)
CREATE OR REPLACE VIEW workers AS
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.tenant_id,
  p.is_active,
  p.pay_rate_category_id,
  p.preferred_start_time,
  p.preferred_end_time,
  p.preferred_days,
  p.created_at,
  p.updated_at
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id 
  AND ur.role IN ('worker', 'supervisor', 'tenant_admin')
);

-- Ensure tenant_settings table has proper structure
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tenant_settings' AND schemaname = 'public') THEN
    CREATE TABLE tenant_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      renewal_notification_email TEXT,
      company_name TEXT,
      company_legal_name TEXT,
      abn TEXT,
      company_phone TEXT,
      company_email TEXT,
      company_website TEXT,
      address_line_1 TEXT,
      address_line_2 TEXT,
      city TEXT,
      state TEXT,
      postcode TEXT,
      country TEXT DEFAULT 'Australia',
      logo_url TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id)
    );

    ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view tenant settings"
      ON tenant_settings FOR SELECT
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage tenant settings"
      ON tenant_settings FOR ALL
      USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'))
      WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));
  END IF;
END $$;

-- Ensure tenants table exists with proper structure
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tenants' AND schemaname = 'public') THEN
    CREATE TABLE tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their tenant"
      ON tenants FOR SELECT
      USING (id = get_user_tenant_id());
  END IF;
END $$;