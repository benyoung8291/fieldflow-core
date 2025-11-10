-- Add worker module flags to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS service_orders_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS projects_enabled boolean DEFAULT false;

-- Create project_workers table for roster management
CREATE TABLE IF NOT EXISTS project_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'team_member', -- team_member, lead, supervisor
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid NOT NULL,
  hourly_rate numeric,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(project_id, worker_id)
);

-- Create project_attachments table
CREATE TABLE IF NOT EXISTS project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  category text DEFAULT 'general', -- general, contract, drawing, photo, document
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone DEFAULT now(),
  notes text
);

-- Create project_contracts table with AI extraction fields
CREATE TABLE IF NOT EXISTS project_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  attachment_id uuid REFERENCES project_attachments(id) ON DELETE SET NULL,
  contract_number text,
  contract_value numeric,
  start_date date,
  end_date date,
  payment_terms text,
  retention_percentage numeric DEFAULT 0,
  variations_allowed boolean DEFAULT true,
  builder_name text,
  builder_abn text,
  builder_contact text,
  extracted_data jsonb, -- stores raw AI extraction
  extraction_status text DEFAULT 'pending', -- pending, processing, completed, failed
  extraction_error text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create project_change_orders table
CREATE TABLE IF NOT EXISTS project_change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  change_order_number text NOT NULL,
  title text NOT NULL,
  description text,
  reason text,
  status text DEFAULT 'draft', -- draft, pending_approval, approved, rejected, completed
  budget_impact numeric NOT NULL DEFAULT 0,
  schedule_impact_days integer DEFAULT 0,
  requested_by uuid NOT NULL,
  requested_at timestamp with time zone DEFAULT now(),
  approved_by uuid,
  approved_at timestamp with time zone,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add budget tracking columns to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS original_budget numeric,
ADD COLUMN IF NOT EXISTS revised_budget numeric,
ADD COLUMN IF NOT EXISTS total_change_orders numeric DEFAULT 0;

-- Update revised_budget to match budget for existing projects
UPDATE projects SET original_budget = budget, revised_budget = budget WHERE original_budget IS NULL;

-- Enable RLS
ALTER TABLE project_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_change_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_workers
CREATE POLICY "Users can view project workers in their tenant"
ON project_workers FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can manage project workers in their tenant"
ON project_workers FOR ALL
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for project_attachments
CREATE POLICY "Users can view project attachments in their tenant"
ON project_attachments FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can manage project attachments in their tenant"
ON project_attachments FOR ALL
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for project_contracts
CREATE POLICY "Users can view project contracts in their tenant"
ON project_contracts FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can manage project contracts in their tenant"
ON project_contracts FOR ALL
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for project_change_orders
CREATE POLICY "Users can view project change orders in their tenant"
ON project_change_orders FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can manage project change orders in their tenant"
ON project_change_orders FOR ALL
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- Create function to update project budget from change orders
CREATE OR REPLACE FUNCTION update_project_budget_from_change_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Update project's total change orders and revised budget
  UPDATE projects
  SET 
    total_change_orders = (
      SELECT COALESCE(SUM(budget_impact), 0)
      FROM project_change_orders
      WHERE project_id = NEW.project_id AND status = 'approved'
    ),
    revised_budget = original_budget + (
      SELECT COALESCE(SUM(budget_impact), 0)
      FROM project_change_orders
      WHERE project_id = NEW.project_id AND status = 'approved'
    )
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update project budget when change order is approved
CREATE TRIGGER update_budget_on_change_order
AFTER INSERT OR UPDATE OF status ON project_change_orders
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION update_project_budget_from_change_orders();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_workers_project ON project_workers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_workers_worker ON project_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_project_attachments_project ON project_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contracts_project ON project_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_change_orders_project ON project_change_orders(project_id);