-- Drop and recreate the trigger function with stronger logic
CREATE OR REPLACE FUNCTION set_line_item_next_generation_date()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: Always initialize next_generation_date from first_generation_date if not set or invalid
  IF TG_OP = 'INSERT' THEN
    -- Force next_generation_date to first_generation_date on insert (ignore any passed value)
    NEW.next_generation_date := NEW.first_generation_date;
  END IF;
  
  -- On UPDATE: If first_generation_date changed and next_generation_date wasn't explicitly being updated
  -- or if next_generation_date is NULL, reset it
  IF TG_OP = 'UPDATE' THEN
    IF NEW.next_generation_date IS NULL THEN
      NEW.next_generation_date := NEW.first_generation_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger fires on INSERT
DROP TRIGGER IF EXISTS set_line_item_next_gen_date ON service_contract_line_items;
CREATE TRIGGER set_line_item_next_gen_date
  BEFORE INSERT ON service_contract_line_items
  FOR EACH ROW
  EXECUTE FUNCTION set_line_item_next_generation_date();