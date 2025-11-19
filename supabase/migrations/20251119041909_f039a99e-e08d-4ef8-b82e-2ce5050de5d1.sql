-- Rebuild purchase order linking from first principles
-- Ensure service_order_id and project_id columns exist with proper constraints and indexes

-- Add indexes for performance on linking columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_order_id 
  ON purchase_orders(service_order_id) 
  WHERE service_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id 
  ON purchase_orders(project_id) 
  WHERE project_id IS NOT NULL;

-- Add index on tenant_id for RLS performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id 
  ON purchase_orders(tenant_id);

-- Ensure we have a comment documenting the linking logic
COMMENT ON COLUMN purchase_orders.service_order_id IS 'Links PO to a service order. Mutually exclusive with project_id - only one can be set.';
COMMENT ON COLUMN purchase_orders.project_id IS 'Links PO to a project. Mutually exclusive with service_order_id - only one can be set.';