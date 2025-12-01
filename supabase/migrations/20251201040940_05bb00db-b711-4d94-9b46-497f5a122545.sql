-- Create floor_plan_share_links table
CREATE TABLE floor_plan_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Relationships
  floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  location_id UUID NOT NULL REFERENCES customer_locations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Configuration (user-settable)
  expires_at TIMESTAMPTZ NOT NULL,
  max_submissions INTEGER NOT NULL DEFAULT 2,
  
  -- Tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Control
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Optional metadata
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_share_links_token ON floor_plan_share_links(token);
CREATE INDEX idx_share_links_created_by ON floor_plan_share_links(created_by);
CREATE INDEX idx_share_links_expires ON floor_plan_share_links(expires_at) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE floor_plan_share_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create share links
CREATE POLICY "Users can create their own share links"
  ON floor_plan_share_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Authenticated users can view their own share links
CREATE POLICY "Users can view their own share links"
  ON floor_plan_share_links FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Authenticated users can update (deactivate) their own share links
CREATE POLICY "Users can update their own share links"
  ON floor_plan_share_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Anonymous users can validate tokens (read only active, non-expired links)
CREATE POLICY "Anon can read active non-expired links by token"
  ON floor_plan_share_links FOR SELECT
  TO anon
  USING (
    is_active = TRUE 
    AND expires_at > NOW()
    AND (max_submissions IS NULL OR usage_count < max_submissions)
  );