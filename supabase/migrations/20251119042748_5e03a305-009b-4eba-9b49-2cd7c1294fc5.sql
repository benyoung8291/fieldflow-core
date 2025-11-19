-- Drop and recreate service_order_id column to force schema cache refresh
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS service_order_id CASCADE;
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS project_id CASCADE;

-- Re-add the columns
ALTER TABLE purchase_orders ADD COLUMN service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;
ALTER TABLE purchase_orders ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_order ON purchase_orders(service_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON purchase_orders(project_id);

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';