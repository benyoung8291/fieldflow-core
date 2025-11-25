-- Fix next_generation_date for contract line items to be based on contract start_date
-- This ensures line items can be generated immediately

UPDATE service_contract_line_items scli
SET next_generation_date = COALESCE(
  scli.next_generation_date,
  sc.start_date,
  CURRENT_DATE
)
FROM service_contracts sc
WHERE scli.contract_id = sc.id
  AND sc.status = 'active'
  AND (scli.next_generation_date IS NULL OR scli.next_generation_date > CURRENT_DATE + INTERVAL '30 days');

-- Add a trigger to automatically set next_generation_date to contract start_date when line items are created
CREATE OR REPLACE FUNCTION set_line_item_next_generation_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_generation_date IS NULL THEN
    SELECT start_date INTO NEW.next_generation_date
    FROM service_contracts
    WHERE id = NEW.contract_id;
    
    -- If contract start_date is also null, use current date
    IF NEW.next_generation_date IS NULL THEN
      NEW.next_generation_date := CURRENT_DATE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_line_item_next_generation_date
BEFORE INSERT ON service_contract_line_items
FOR EACH ROW
EXECUTE FUNCTION set_line_item_next_generation_date();