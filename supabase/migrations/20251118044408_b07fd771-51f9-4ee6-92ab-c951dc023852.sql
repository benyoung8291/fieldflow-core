
-- Fix the generate_service_orders_from_contracts function to remove non-existent 'notes' column
CREATE OR REPLACE FUNCTION public.generate_service_orders_from_contracts(
  p_start_date DATE,
  p_end_date DATE,
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_line_items RECORD;
  v_group RECORD;
  v_order_id UUID;
  v_order_number TEXT;
  v_last_number INT;
  v_orders_created INT := 0;
  v_total_items INT := 0;
  v_already_generated INT := 0;
  v_errors JSONB := '[]'::JSONB;
  v_estimated_hours NUMERIC;
  v_fixed_amount NUMERIC;
  v_title TEXT;
  v_description TEXT;
BEGIN
  -- Count total line items in range
  SELECT COUNT(*) INTO v_total_items
  FROM service_contract_line_items scli
  INNER JOIN service_contracts sc ON scli.contract_id = sc.id
  WHERE sc.tenant_id = p_tenant_id
    AND sc.status = 'active'
    AND sc.auto_generate = true
    AND scli.next_generation_date >= p_start_date
    AND scli.next_generation_date <= p_end_date;

  -- Check for already-generated line items
  SELECT COUNT(DISTINCT scli.id) INTO v_already_generated
  FROM service_contract_line_items scli
  INNER JOIN service_contracts sc ON scli.contract_id = sc.id
  INNER JOIN service_order_line_items soli ON soli.contract_line_item_id = scli.id
  INNER JOIN service_orders so ON soli.service_order_id = so.id
  WHERE sc.tenant_id = p_tenant_id
    AND sc.status = 'active'
    AND sc.auto_generate = true
    AND scli.next_generation_date >= p_start_date
    AND scli.next_generation_date <= p_end_date
    AND so.generated_from_date = scli.next_generation_date;

  -- Loop through grouped line items (by location + date)
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
      array_agg(scli.line_total) AS line_totals,
      array_agg(scli.estimated_hours) AS estimated_hours_array,
      array_agg(scli.key_number) AS key_numbers,
      array_agg(scli.recurrence_frequency) AS frequencies
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND sc.auto_generate = true
      AND scli.next_generation_date >= p_start_date
      AND scli.next_generation_date <= p_end_date
      AND NOT EXISTS (
        SELECT 1 FROM service_order_line_items soli
        INNER JOIN service_orders so ON soli.service_order_id = so.id
        WHERE soli.contract_line_item_id = scli.id
          AND so.generated_from_date = scli.next_generation_date
      )
    GROUP BY scli.location_id, scli.next_generation_date, scli.contract_id, 
             sc.contract_number, sc.title, sc.customer_id
  LOOP
    BEGIN
      -- Generate order number
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0)
      INTO v_last_number
      FROM service_orders
      WHERE tenant_id = p_tenant_id;
      
      v_order_number := 'SO-' || LPAD((v_last_number + 1)::TEXT, 5, '0');

      -- Calculate totals
      SELECT 
        SUM(val) INTO v_estimated_hours
      FROM unnest(v_group.estimated_hours_array) val;

      SELECT 
        SUM(val) INTO v_fixed_amount
      FROM unnest(v_group.line_totals) val;

      -- Create title and description
      IF array_length(v_group.line_item_ids, 1) = 1 THEN
        v_title := v_group.descriptions[1];
        v_description := v_group.descriptions[1] || ' (Qty: ' || v_group.quantities[1]::TEXT || 
                        CASE WHEN v_group.estimated_hours_array[1] IS NOT NULL 
                             THEN ', Est. Hours: ' || v_group.estimated_hours_array[1]::TEXT 
                             ELSE '' END || ')';
      ELSE
        v_title := v_group.contract_title || ' - Multiple Services';
        v_description := array_to_string(
          ARRAY(
            SELECT unnest(v_group.descriptions) || ' (Qty: ' || unnest(v_group.quantities)::TEXT || 
                   CASE WHEN unnest(v_group.estimated_hours_array) IS NOT NULL 
                        THEN ', Est. Hours: ' || unnest(v_group.estimated_hours_array)::TEXT 
                        ELSE '' END || ')'
          ),
          E'\n'
        );
      END IF;

      -- Create service order (removed notes field)
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
        created_by
      ) VALUES (
        p_tenant_id,
        v_group.customer_id,
        v_group.contract_id,
        v_order_number,
        v_title,
        v_description,
        'draft',
        'fixed',
        v_fixed_amount,
        v_estimated_hours,
        'normal',
        v_group.location_id,
        CASE WHEN array_length(v_group.line_item_ids, 1) = 1 THEN v_group.key_numbers[1] ELSE NULL END,
        v_group.generation_date,
        p_user_id
      ) RETURNING id INTO v_order_id;

      -- Create line items
      FOR i IN 1..array_length(v_group.line_item_ids, 1) LOOP
        INSERT INTO service_order_line_items (
          tenant_id,
          service_order_id,
          contract_line_item_id,
          description,
          quantity,
          unit_price,
          line_total,
          item_order,
          estimated_hours
        ) VALUES (
          p_tenant_id,
          v_order_id,
          v_group.line_item_ids[i],
          v_group.descriptions[i],
          v_group.quantities[i],
          v_group.unit_prices[i],
          v_group.line_totals[i],
          i - 1,
          v_group.estimated_hours_array[i]
        );

        -- Update next generation date
        UPDATE service_contract_line_items
        SET next_generation_date = calculate_next_generation_date(
          v_group.generation_date,
          v_group.frequencies[i]
        )
        WHERE id = v_group.line_item_ids[i];
      END LOOP;

      v_orders_created := v_orders_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'location_id', v_group.location_id,
        'generation_date', v_group.generation_date,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'orders_created', v_orders_created,
      'total_line_items', v_total_items,
      'already_generated', v_already_generated,
      'errors', v_errors
    )
  );
END;
$$;
