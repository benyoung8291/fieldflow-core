-- Force PostgREST schema cache reload by adding a comment to the table
-- This forces PostgREST to recognize the service_order_id and project_id columns

COMMENT ON TABLE purchase_orders IS 'Purchase orders with service order and project linkage - updated schema';

-- Add explicit comments to the columns to ensure PostgREST sees them
COMMENT ON COLUMN purchase_orders.service_order_id IS 'Linked service order ID';
COMMENT ON COLUMN purchase_orders.project_id IS 'Linked project ID';

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';