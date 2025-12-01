-- Update the trigger function to reset next_generation_date on line items
-- when a service order is deleted, allowing regeneration to work
CREATE OR REPLACE FUNCTION delete_generation_history_on_service_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history RECORD;
BEGIN
  -- Before deleting, reset the next_generation_date for affected line items
  FOR v_history IN 
    SELECT contract_line_item_id, generation_date 
    FROM service_contract_generation_history 
    WHERE service_order_id = OLD.id
  LOOP
    -- Reset the next_generation_date back to the generation_date
    -- This allows the line item to be picked up for regeneration
    UPDATE service_contract_line_items
    SET next_generation_date = v_history.generation_date
    WHERE id = v_history.contract_line_item_id
      -- Only reset if the current next_generation_date is after the generation_date
      -- (meaning it was advanced during the original generation)
      AND (next_generation_date IS NULL OR next_generation_date > v_history.generation_date);
  END LOOP;

  -- Delete generation history records for the deleted service order
  DELETE FROM service_contract_generation_history
  WHERE service_order_id = OLD.id;
  
  RETURN OLD;
END;
$$;