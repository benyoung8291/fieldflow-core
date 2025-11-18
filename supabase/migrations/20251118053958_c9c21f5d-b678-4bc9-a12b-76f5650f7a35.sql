-- Force schema refresh for purchase_orders table by adding a comment
COMMENT ON COLUMN purchase_orders.service_order_id IS 'Links purchase order to originating service order';

-- Ensure the column has proper indexing for query performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_order_id ON purchase_orders(service_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON purchase_orders(project_id);
