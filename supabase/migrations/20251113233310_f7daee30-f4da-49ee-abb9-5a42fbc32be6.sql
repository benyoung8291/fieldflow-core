-- Create general_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS general_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overhead_percentage NUMERIC(5,2) DEFAULT 20.00,
  default_margin_percentage NUMERIC(5,2) DEFAULT 30.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE general_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their tenant's general settings"
  ON general_settings
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their tenant's general settings"
  ON general_settings
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tenant's general settings"
  ON general_settings
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE general_settings IS 'General application settings per tenant';
COMMENT ON COLUMN general_settings.overhead_percentage IS 'Overhead percentage applied to worker hourly rates';
COMMENT ON COLUMN general_settings.default_margin_percentage IS 'Default margin percentage used when creating new quote line items';