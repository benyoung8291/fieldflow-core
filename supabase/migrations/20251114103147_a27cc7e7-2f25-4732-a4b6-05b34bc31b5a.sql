-- Force types regeneration by ensuring suppliers table is properly defined
-- This migration ensures the suppliers table structure is correct and triggers types sync

-- First, ensure the suppliers table has all required columns
DO $$ 
BEGIN
    -- Add any missing columns (will skip if they already exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'suppliers' AND column_name = 'name') THEN
        ALTER TABLE suppliers ADD COLUMN name TEXT NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'suppliers' AND column_name = 'abn') THEN
        ALTER TABLE suppliers ADD COLUMN abn TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'suppliers' AND column_name = 'gst_registered') THEN
        ALTER TABLE suppliers ADD COLUMN gst_registered BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'suppliers' AND column_name = 'is_active') THEN
        ALTER TABLE suppliers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Ensure purchase_orders has supplier_id (not vendor_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'purchase_orders' AND column_name = 'vendor_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'purchase_orders' AND column_name = 'supplier_id') THEN
        -- Rename vendor_id to supplier_id
        ALTER TABLE purchase_orders RENAME COLUMN vendor_id TO supplier_id;
    END IF;
END $$;

-- Force a types regeneration by updating table comment
COMMENT ON TABLE suppliers IS 'Suppliers and vendors for purchase orders and expenses';