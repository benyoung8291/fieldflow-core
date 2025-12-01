-- Comprehensive fix: Restore generation history tracking, add audit logging, and deletion trigger

-- Drop the existing function
DROP FUNCTION IF EXISTS public.generate_service_orders_from_contracts(uuid, date, date, uuid);

-- Recreate the function with full generation history tracking and audit logging
CREATE OR REPLACE FUNCTION public.generate_service_orders_from_contracts(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_service_order_id UUID;
  v_order_number TEXT;
  v_orders_created INT := 0;
  v_total_items INT := 0;
  v_already_generated INT := 0;
  v_errors JSONB := '[]'::JSONB;
  v_estimated_hours NUMERIC;
  v_fixed_amount NUMERIC;
  v_title TEXT;
  v_description TEXT;
  v_settings RECORD;
  v_next_number BIGINT;
  v_history_ids UUID[];
  v_description_parts TEXT[];
  v_user_name TEXT;
  v_contract_number TEXT;
BEGIN
  -- Get user name for audit logs
  SELECT COALESCE(first_name || ' ' || COALESCE(last_name, ''), 'System') INTO v_user_name
  FROM profiles WHERE id = p_user_id;

  -- Count total items to process
  SELECT COUNT(*) INTO v_total_items
  FROM service_contract_line_items scli
  INNER JOIN service_contracts sc ON scli.contract_id = sc.id
  WHERE sc.tenant_id = p_tenant_id
    AND sc.status = 'active'
    AND sc.auto_generate = true
    AND scli.next_generation_date >= p_start_date
    AND scli.next_generation_date <= p_end_date;

  -- Count already generated
  SELECT COUNT(DISTINCT scli.id) INTO v_already_generated
  FROM service_contract_line_items scli
  INNER JOIN service_contracts sc ON scli.contract_id = sc.id
  INNER JOIN service_contract_generation_history sgh ON sgh.contract_line_item_id = scli.id
  WHERE sc.tenant_id = p_tenant_id
    AND sc.status = 'active'
    AND sc.auto_generate = true
    AND scli.next_generation_date >= p_start_date
    AND scli.next_generation_date <= p_end_date
    AND sgh.generation_date = scli.next_generation_date;

  -- Ensure sequential number settings exist
  INSERT INTO public.sequential_number_settings (tenant_id, entity_type, next_number)
  VALUES (p_tenant_id, 'service_order', 1)
  ON CONFLICT (tenant_id, entity_type) DO NOTHING;

  -- Process groups by location, date, and contract
  FOR v_group IN
    SELECT 
      scli.location_id,
      scli.next_generation_date AS generation_date,
      scli.contract_id,
      sc.contract_number,
      sc.title AS contract_title,
      sc.customer_id,
      array_agg(scli.id) AS line_item_ids,
      array_agg(scli.description) AS descriptions,
      array_agg(scli.quantity) AS quantities,
      array_agg(scli.unit_price) AS unit_prices,
      array_agg(scli.cost_price) AS cost_prices,
      array_agg(scli.line_total) AS line_totals,
      array_agg(scli.estimated_hours) AS estimated_hours_array,
      array_agg(scli.key_number) AS key_numbers,
      array_agg(scli.recurrence_frequency::text) AS frequencies,
      array_agg(EXTRACT(DAY FROM scli.first_generation_date)::integer) AS original_days
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND sc.auto_generate = true
      AND scli.next_generation_date >= p_start_date
      AND scli.next_generation_date <= p_end_date
      AND NOT EXISTS (
        SELECT 1 FROM service_contract_generation_history sgh
        WHERE sgh.contract_line_item_id = scli.id
          AND sgh.generation_date = scli.next_generation_date
      )
    GROUP BY scli.location_id, scli.next_generation_date, scli.contract_id, 
             sc.contract_number, sc.title, sc.customer_id
  LOOP
    BEGIN
      -- Get next service order number using proper sequential function
      v_order_number := get_next_sequential_number(p_tenant_id, 'service_order');

      -- Calculate totals
      SELECT COALESCE(SUM(val), 0) INTO v_estimated_hours
      FROM unnest(v_group.estimated_hours_array) val;

      SELECT COALESCE(SUM(val), 0) INTO v_fixed_amount
      FROM unnest(v_group.line_totals) val;

      -- Build title and description
      IF array_length(v_group.line_item_ids, 1) = 1 THEN
        v_title := v_group.descriptions[1];
        v_description := v_group.descriptions[1] || ' (Qty: ' || v_group.quantities[1]::TEXT || 
                        COALESCE(', Est. Hours: ' || v_group.estimated_hours_array[1]::TEXT, '') || ')';
      ELSE
        v_title := v_group.contract_title || ' - Multiple Services';
        v_description_parts := ARRAY[]::TEXT[];
        FOR i IN 1..array_length(v_group.line_item_ids, 1) LOOP
          v_description_parts := array_append(
            v_description_parts,
            v_group.descriptions[i] || ' (Qty: ' || v_group.quantities[i]::TEXT || 
            COALESCE(', Est. Hours: ' || v_group.estimated_hours_array[i]::TEXT, '') || ')'
          );
        END LOOP;
        v_description := array_to_string(v_description_parts, E'\n');
      END IF;

      -- Create service order with all required fields
      INSERT INTO service_orders (
        tenant_id,
        customer_id,
        contract_id,
        order_number,
        title,
        description,
        status,
        billing_type,
        fixed_amount,
        estimated_hours,
        priority,
        location_id,
        key_number,
        generated_from_date,
        preferred_date,
        created_by
      ) VALUES (
        p_tenant_id,
        v_group.customer_id,
        v_group.contract_id,
        v_order_number,
        v_title,
        v_description,
        'pending',
        'fixed_price',
        v_fixed_amount,
        v_estimated_hours,
        'medium',
        v_group.location_id,
        v_group.key_numbers[1],
        v_group.generation_date,
        v_group.generation_date,
        p_user_id
      ) RETURNING id INTO v_service_order_id;

      -- Insert audit log for service order creation
      INSERT INTO audit_logs (
        tenant_id,
        user_id,
        user_name,
        table_name,
        record_id,
        action,
        note
      ) VALUES (
        p_tenant_id,
        p_user_id,
        v_user_name,
        'service_orders',
        v_service_order_id,
        'create',
        'Generated from Service Contract ' || v_group.contract_number || ' for date ' || v_group.generation_date::TEXT
      );

      -- Record generation history for each line item
      v_history_ids := ARRAY[]::UUID[];
      FOR i IN 1..array_length(v_group.line_item_ids, 1) LOOP
        INSERT INTO service_contract_generation_history (
          tenant_id,
          contract_id,
          contract_line_item_id,
          service_order_id,
          generation_date,
          quantity,
          unit_price,
          line_total,
          created_by
        ) VALUES (
          p_tenant_id,
          v_group.contract_id,
          v_group.line_item_ids[i],
          v_service_order_id,
          v_group.generation_date,
          v_group.quantities[i],
          v_group.unit_prices[i],
          v_group.line_totals[i],
          p_user_id
        ) RETURNING id INTO v_history_ids[i];

        -- Update next_generation_date for the line item
        UPDATE service_contract_line_items
        SET next_generation_date = calculate_next_generation_date(
          v_group.generation_date,
          v_group.frequencies[i],
          v_group.original_days[i]
        )
        WHERE id = v_group.line_item_ids[i];
      END LOOP;

      v_orders_created := v_orders_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'contract_id', v_group.contract_id,
        'location_id', v_group.location_id,
        'generation_date', v_group.generation_date,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'orders_created', v_orders_created,
    'total_items', v_total_items,
    'already_generated', v_already_generated,
    'errors', v_errors
  );
END;
$$;

-- Create trigger to delete generation history when service order is deleted
-- This allows regeneration of service orders
CREATE OR REPLACE FUNCTION delete_generation_history_on_service_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete generation history records for the deleted service order
  DELETE FROM service_contract_generation_history
  WHERE service_order_id = OLD.id;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_delete_generation_history ON service_orders;

CREATE TRIGGER tr_delete_generation_history
  BEFORE DELETE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION delete_generation_history_on_service_order_delete();