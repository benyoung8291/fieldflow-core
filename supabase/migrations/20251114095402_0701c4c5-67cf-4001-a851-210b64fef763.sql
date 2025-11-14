
-- Add foreign key constraints to purchase_orders table
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_vendor_id_fkey 
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_service_order_id_fkey 
  FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE SET NULL;
