-- Function to advance past generation dates to future
CREATE OR REPLACE FUNCTION public.advance_past_generation_dates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_line_item RECORD;
  v_new_date DATE;
  v_updated_count INT := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Loop through all line items with past generation dates
  FOR v_line_item IN
    SELECT 
      scli.id,
      scli.next_generation_date,
      scli.recurrence_frequency,
      scli.description
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE scli.next_generation_date < v_today
      AND sc.status = 'active'
  LOOP
    -- Calculate the next valid date from today
    v_new_date := v_line_item.next_generation_date;
    
    -- Keep advancing until we're at or past today
    WHILE v_new_date < v_today LOOP
      v_new_date := calculate_next_generation_date(v_new_date, v_line_item.recurrence_frequency);
      
      -- Safety check to prevent infinite loop
      IF v_new_date IS NULL THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- Update the line item if we found a valid future date
    IF v_new_date IS NOT NULL AND v_new_date >= v_today THEN
      UPDATE service_contract_line_items
      SET next_generation_date = v_new_date
      WHERE id = v_line_item.id;
      
      v_updated_count := v_updated_count + 1;
      
      RAISE NOTICE 'Updated line item %: % -> %', 
        v_line_item.description, 
        v_line_item.next_generation_date, 
        v_new_date;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'message', 'Advanced ' || v_updated_count || ' line items to future dates'
  );
END;
$function$;