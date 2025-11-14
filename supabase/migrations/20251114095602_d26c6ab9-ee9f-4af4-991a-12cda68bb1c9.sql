
-- Rename vendors table to suppliers
ALTER TABLE vendors RENAME TO suppliers;

-- Rename vendor_id columns to supplier_id in tables that have it
ALTER TABLE customers RENAME COLUMN vendor_id TO supplier_id;
ALTER TABLE expenses RENAME COLUMN vendor_id TO supplier_id;
ALTER TABLE expense_policy_rules RENAME COLUMN vendor_id TO supplier_id;
ALTER TABLE purchase_orders RENAME COLUMN vendor_id TO supplier_id;

-- Update foreign key constraints with new names
ALTER TABLE purchase_orders 
  DROP CONSTRAINT IF EXISTS purchase_orders_vendor_id_fkey;
  
ALTER TABLE purchase_orders 
  ADD CONSTRAINT purchase_orders_supplier_id_fkey 
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;

-- Update indexes if any exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_purchase_orders_vendor_id') THEN
    ALTER INDEX idx_purchase_orders_vendor_id RENAME TO idx_purchase_orders_supplier_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_expenses_vendor_id') THEN
    ALTER INDEX idx_expenses_vendor_id RENAME TO idx_expenses_supplier_id;
  END IF;
END $$;
