-- Add estimated_hours column to quote_line_items (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' AND column_name = 'estimated_hours'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN estimated_hours numeric DEFAULT 0;
  END IF;
END $$;

-- Add estimated_hours column to service_contract_line_items (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_contract_line_items' AND column_name = 'estimated_hours'
  ) THEN
    ALTER TABLE service_contract_line_items ADD COLUMN estimated_hours numeric DEFAULT 0;
  END IF;
END $$;