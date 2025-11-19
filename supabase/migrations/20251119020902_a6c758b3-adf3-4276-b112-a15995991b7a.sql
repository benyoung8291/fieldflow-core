-- Add service_order_id and project_id columns to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_order_id ON purchase_orders(service_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON purchase_orders(project_id);

-- Add comment for documentation
COMMENT ON COLUMN purchase_orders.service_order_id IS 'Link to the service order this PO is associated with';
COMMENT ON COLUMN purchase_orders.project_id IS 'Link to the project this PO is associated with';