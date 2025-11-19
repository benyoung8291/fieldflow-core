-- Create table for caching chart of accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'myob_acumatica' or 'xero'
  account_code TEXT NOT NULL,
  description TEXT,
  account_type TEXT,
  is_active BOOLEAN DEFAULT true,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, provider, account_code)
);

-- Create table for caching sub-accounts (Acumatica only)
CREATE TABLE IF NOT EXISTS sub_accounts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- should always be 'myob_acumatica'
  sub_account_code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, provider, sub_account_code)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_provider ON chart_of_accounts_cache(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_tenant_provider ON sub_accounts_cache(tenant_id, provider);

-- Enable RLS
ALTER TABLE chart_of_accounts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_accounts_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for chart_of_accounts_cache
CREATE POLICY "Users can view their tenant's cached accounts"
  ON chart_of_accounts_cache FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their tenant's cached accounts"
  ON chart_of_accounts_cache FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tenant's cached accounts"
  ON chart_of_accounts_cache FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their tenant's cached accounts"
  ON chart_of_accounts_cache FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS policies for sub_accounts_cache
CREATE POLICY "Users can view their tenant's cached sub-accounts"
  ON sub_accounts_cache FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their tenant's cached sub-accounts"
  ON sub_accounts_cache FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tenant's cached sub-accounts"
  ON sub_accounts_cache FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their tenant's cached sub-accounts"
  ON sub_accounts_cache FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );