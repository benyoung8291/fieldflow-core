-- Drop the old day-based columns from worker_seasonal_availability
ALTER TABLE worker_seasonal_availability 
  DROP COLUMN IF EXISTS monday_available,
  DROP COLUMN IF EXISTS monday_periods,
  DROP COLUMN IF EXISTS tuesday_available,
  DROP COLUMN IF EXISTS tuesday_periods,
  DROP COLUMN IF EXISTS wednesday_available,
  DROP COLUMN IF EXISTS wednesday_periods,
  DROP COLUMN IF EXISTS thursday_available,
  DROP COLUMN IF EXISTS thursday_periods,
  DROP COLUMN IF EXISTS friday_available,
  DROP COLUMN IF EXISTS friday_periods,
  DROP COLUMN IF EXISTS saturday_available,
  DROP COLUMN IF EXISTS saturday_periods,
  DROP COLUMN IF EXISTS sunday_available,
  DROP COLUMN IF EXISTS sunday_periods;

-- Create new table for date-specific availability
CREATE TABLE IF NOT EXISTS worker_seasonal_availability_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seasonal_availability_id UUID NOT NULL REFERENCES worker_seasonal_availability(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  periods TEXT[] NOT NULL DEFAULT '{}',
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seasonal_availability_id, date)
);

-- Enable RLS
ALTER TABLE worker_seasonal_availability_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workers to manage their own dates
CREATE POLICY "Workers can view their own seasonal availability dates"
  ON worker_seasonal_availability_dates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM worker_seasonal_availability wsa
      WHERE wsa.id = seasonal_availability_id
      AND wsa.worker_id = auth.uid()
    )
  );

CREATE POLICY "Workers can insert their own seasonal availability dates"
  ON worker_seasonal_availability_dates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM worker_seasonal_availability wsa
      WHERE wsa.id = seasonal_availability_id
      AND wsa.worker_id = auth.uid()
    )
  );

CREATE POLICY "Workers can update their own seasonal availability dates"
  ON worker_seasonal_availability_dates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM worker_seasonal_availability wsa
      WHERE wsa.id = seasonal_availability_id
      AND wsa.worker_id = auth.uid()
    )
  );

CREATE POLICY "Workers can delete their own seasonal availability dates"
  ON worker_seasonal_availability_dates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM worker_seasonal_availability wsa
      WHERE wsa.id = seasonal_availability_id
      AND wsa.worker_id = auth.uid()
    )
  );

-- RLS Policies for supervisors/admins
CREATE POLICY "Supervisors can view all seasonal availability dates in tenant"
  ON worker_seasonal_availability_dates
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'tenant_admin', 'supervisor', 'management')
    )
  );

CREATE POLICY "Supervisors can insert seasonal availability dates in tenant"
  ON worker_seasonal_availability_dates
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'tenant_admin', 'supervisor', 'management')
    )
  );

CREATE POLICY "Supervisors can update seasonal availability dates in tenant"
  ON worker_seasonal_availability_dates
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'tenant_admin', 'supervisor', 'management')
    )
  );

CREATE POLICY "Supervisors can delete seasonal availability dates in tenant"
  ON worker_seasonal_availability_dates
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'tenant_admin', 'supervisor', 'management')
    )
  );

-- Create index for faster queries
CREATE INDEX idx_seasonal_availability_dates_period ON worker_seasonal_availability_dates(seasonal_availability_id, date);