-- Fix function to cast enum to text
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
  FOR v_line_item IN
    SELECT 
      scli.id,
      scli.next_generation_date,
      scli.recurrence_frequency::text as recurrence_frequency,
      scli.description
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE scli.next_generation_date < v_today
      AND sc.status = 'active'
  LOOP
    v_new_date := v_line_item.next_generation_date;
    
    WHILE v_new_date < v_today LOOP
      v_new_date := calculate_next_generation_date(v_new_date, v_line_item.recurrence_frequency);
      
      IF v_new_date IS NULL THEN
        EXIT;
      END IF;
    END LOOP;
    
    IF v_new_date IS NOT NULL AND v_new_date >= v_today THEN
      UPDATE service_contract_line_items
      SET next_generation_date = v_new_date
      WHERE id = v_line_item.id;
      
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
END;
$function$;