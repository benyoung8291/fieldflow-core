-- Fix search_path for the trigger function
CREATE OR REPLACE FUNCTION set_line_item_next_generation_date()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;