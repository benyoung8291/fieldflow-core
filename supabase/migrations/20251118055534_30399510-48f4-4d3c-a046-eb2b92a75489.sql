-- Force PostgREST to reload schema cache by adding and immediately using a comment
COMMENT ON COLUMN purchase_orders.service_order_id IS 'Links PO to source service order';
COMMENT ON COLUMN purchase_orders.project_id IS 'Links PO to source project';

-- Verify the columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' 
    AND column_name = 'service_order_id'
  ) THEN
    RAISE EXCEPTION 'service_order_id column is missing!';
  END IF;
END $$;

-- Force a notification to PostgREST
NOTIFY pgrst, 'reload schema';