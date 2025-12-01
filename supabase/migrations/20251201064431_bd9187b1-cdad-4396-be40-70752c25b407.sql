-- Fix the generate_service_orders_from_contracts function by removing non-existent default_worker_id column
DROP FUNCTION IF EXISTS generate_service_orders_from_contracts(uuid, date, date, uuid);

-- Recreate the function without the default_worker_id reference
CREATE FUNCTION public.generate_service_orders_from_contracts(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_line_item RECORD;
  v_service_order_id uuid;
  v_work_order_number text;
  v_generated_count int := 0;
  v_skipped_count int := 0;
  v_error_count int := 0;
  v_history_id uuid;
  v_errors jsonb := '[]'::jsonb;
  v_generation_date date;
  v_original_day_of_month int;
BEGIN
  FOR v_line_item IN
    SELECT 
      scli.id as line_item_id,
      scli.contract_id,
      scli.description,
      scli.quantity,
      scli.unit_price,
      scli.recurrence_frequency::text as recurrence_frequency,
      scli.next_generation_date,
      sc.customer_id,
      sc.contract_number,
      sc.start_date as contract_start_date,
      sc.end_date as contract_end_date,
      cl.id as location_id,
      cl.name as location_name
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    LEFT JOIN customer_locations cl ON scli.location_id = cl.id
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND scli.next_generation_date IS NOT NULL
      AND scli.next_generation_date >= p_start_date
      AND scli.next_generation_date <= p_end_date
      AND scli.recurrence_frequency::text != 'one_time'
    ORDER BY scli.next_generation_date, sc.customer_id, cl.id, scli.contract_id
  LOOP
    BEGIN
      v_generation_date := v_line_item.next_generation_date;
      
      -- Store original day of month for monthly recurrences
      v_original_day_of_month := EXTRACT(DAY FROM v_generation_date)::int;
      
      -- Check if a service order already exists for this combination
      IF NOT EXISTS (
        SELECT 1 FROM service_orders so
        WHERE so.tenant_id = p_tenant_id
          AND so.contract_id = v_line_item.contract_id
          AND so.customer_id = v_line_item.customer_id
          AND COALESCE(so.location_id::text, '') = COALESCE(v_line_item.location_id::text, '')
          AND so.scheduled_date = v_generation_date
      ) THEN
        -- Get next sequential work order number
        SELECT get_next_sequential_number('SO', p_tenant_id) INTO v_work_order_number;
        
        -- Create service order (without assigned_to, since default_worker_id doesn't exist)
        INSERT INTO service_orders (
          tenant_id,
          work_order_number,
          customer_id,
          location_id,
          contract_id,
          title,
          description,
          scheduled_date,
          status,
          billing_type,
          estimated_cost,
          priority,
          created_by
        ) VALUES (
          p_tenant_id,
          v_work_order_number,
          v_line_item.customer_id,
          v_line_item.location_id,
          v_line_item.contract_id,
          'Service Order for ' || v_line_item.contract_number || 
            CASE WHEN v_line_item.location_name IS NOT NULL 
              THEN ' - ' || v_line_item.location_name 
              ELSE '' 
            END,
          v_line_item.description,
          v_generation_date,
          'draft',
          'fixed',
          v_line_item.quantity * v_line_item.unit_price,
          'normal',
          p_user_id
        )
        RETURNING id INTO v_service_order_id;
        
        -- Record generation in history
        INSERT INTO service_contract_generation_history (
          tenant_id,
          contract_id,
          contract_line_item_id,
          service_order_id,
          generation_date,
          generated_by
        ) VALUES (
          p_tenant_id,
          v_line_item.contract_id,
          v_line_item.line_item_id,
          v_service_order_id,
          v_generation_date,
          p_user_id
        ) RETURNING id INTO v_history_id;
        
        -- Add audit log entry
        INSERT INTO audit_logs (
          tenant_id,
          table_name,
          record_id,
          action,
          user_id,
          user_name,
          note
        ) VALUES (
          p_tenant_id,
          'service_orders',
          v_service_order_id,
          'create',
          p_user_id,
          (SELECT COALESCE(full_name, email) FROM profiles WHERE id = p_user_id),
          'Service order generated from contract line item'
        );
        
        v_generated_count := v_generated_count + 1;
        
        -- Calculate and update next generation date
        UPDATE service_contract_line_items
        SET next_generation_date = calculate_next_generation_date(
          v_generation_date,
          v_line_item.recurrence_frequency,
          v_original_day_of_month
        )
        WHERE id = v_line_item.line_item_id;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'line_item_id', v_line_item.line_item_id,
        'contract_number', v_line_item.contract_number,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'generated_count', v_generated_count,
    'skipped_count', v_skipped_count,
    'error_count', v_error_count,
    'errors', v_errors
  );
END;
$function$;