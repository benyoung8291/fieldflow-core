-- Create workflow tables
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  node_type TEXT NOT NULL, -- 'trigger', 'action', 'condition'
  action_type TEXT, -- For action nodes: 'create_task', 'create_checklist', 'send_email', etc.
  config JSONB DEFAULT '{}'::jsonb,
  position_x NUMERIC DEFAULT 0,
  position_y NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  condition_result TEXT, -- 'true', 'false' for condition nodes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  trigger_data JSONB DEFAULT '{}'::jsonb,
  test_mode BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed', 'skipped'
  output JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflows
CREATE POLICY "Users can view workflows in their tenant"
  ON workflows FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create workflows in their tenant"
  ON workflows FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update workflows in their tenant"
  ON workflows FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete workflows in their tenant"
  ON workflows FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for workflow_nodes
CREATE POLICY "Users can view workflow nodes in their tenant"
  ON workflow_nodes FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create workflow nodes in their tenant"
  ON workflow_nodes FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update workflow nodes in their tenant"
  ON workflow_nodes FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete workflow nodes in their tenant"
  ON workflow_nodes FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for workflow_connections
CREATE POLICY "Users can view workflow connections in their tenant"
  ON workflow_connections FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create workflow connections in their tenant"
  ON workflow_connections FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete workflow connections in their tenant"
  ON workflow_connections FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for workflow_executions
CREATE POLICY "Users can view workflow executions in their tenant"
  ON workflow_executions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can create workflow executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "System can update workflow executions"
  ON workflow_executions FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for workflow_execution_logs
CREATE POLICY "Users can view workflow execution logs in their tenant"
  ON workflow_execution_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can create workflow execution logs"
  ON workflow_execution_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Create indexes for performance
CREATE INDEX idx_workflows_tenant_trigger ON workflows(tenant_id, trigger_type);
CREATE INDEX idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_connections_workflow ON workflow_connections(workflow_id);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_execution_logs_execution ON workflow_execution_logs(execution_id);