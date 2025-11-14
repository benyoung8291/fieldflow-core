-- This migration verifies the suppliers table exists and triggers types regeneration
-- Add a comment to the suppliers table to trigger schema update
COMMENT ON TABLE suppliers IS 'Supplier/vendor information for the business';

-- Ensure all constraints are properly named
DO $$ 
BEGIN
  -- Verify suppliers table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'suppliers') THEN
    RAISE EXCEPTION 'suppliers table does not exist';
  END IF;
END $$;