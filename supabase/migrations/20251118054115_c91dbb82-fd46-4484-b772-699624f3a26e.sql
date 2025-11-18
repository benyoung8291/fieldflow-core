-- Force PostgREST schema cache reload by making a schema change
-- Add a temporary column
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS temp_reload_trigger BOOLEAN DEFAULT false;

-- Immediately drop it to clean up
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS temp_reload_trigger;

-- Verify the service_order_id column exists and has proper constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchase_orders' 
        AND column_name = 'service_order_id'
    ) THEN
        RAISE EXCEPTION 'service_order_id column does not exist - this should not happen';
    END IF;
END $$;

-- Analyze the table to update statistics
ANALYZE purchase_orders;