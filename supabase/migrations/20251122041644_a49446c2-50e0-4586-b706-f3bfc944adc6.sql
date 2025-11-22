-- Create timesheets table first
CREATE TABLE IF NOT EXISTS timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'exported')),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_at timestamp with time zone,
  submitted_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES auth.users(id),
  exported_at timestamp with time zone,
  notes text,
  UNIQUE(tenant_id, week_start_date)
);

-- Enable RLS on timesheets
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

-- Policies for timesheets
CREATE POLICY "Users can view timesheets in their tenant"
  ON timesheets FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Supervisors can manage timesheets"
  ON timesheets FOR ALL
  USING (
    tenant_id = get_user_tenant_id() AND 
    (has_role(auth.uid(), 'supervisor'::user_role) OR 
     has_role(auth.uid(), 'tenant_admin'::user_role))
  );

-- Now add timesheet tracking to time_logs
ALTER TABLE time_logs 
ADD COLUMN IF NOT EXISTS timesheet_status text DEFAULT 'pending' CHECK (timesheet_status IN ('pending', 'processed', 'approved')),
ADD COLUMN IF NOT EXISTS timesheet_id uuid REFERENCES timesheets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS check_out_lat numeric,
ADD COLUMN IF NOT EXISTS check_out_lng numeric;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_logs_timesheet_status ON time_logs(timesheet_status);
CREATE INDEX IF NOT EXISTS idx_time_logs_timesheet_id ON time_logs(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_start ON timesheets(tenant_id, week_start_date);

-- Update time_logs RLS to allow supervisors to update timesheet status
DROP POLICY IF EXISTS "Supervisors can update time logs" ON time_logs;
CREATE POLICY "Supervisors can update time logs"
  ON time_logs FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() AND 
    (has_role(auth.uid(), 'supervisor'::user_role) OR 
     has_role(auth.uid(), 'tenant_admin'::user_role) OR
     has_role(auth.uid(), 'super_admin'::user_role))
  );