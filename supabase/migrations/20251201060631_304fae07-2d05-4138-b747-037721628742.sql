-- Drop the existing function first
DROP FUNCTION IF EXISTS public.generate_service_orders_from_contracts(uuid, date, date, uuid);

-- Recreate the function with correct grouping logic
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
  v_contract RECORD;
  v_line_item RECORD;
  v_service_order_id UUID;
  v_generation_date DATE;
  v_work_order_number TEXT;
  v_sequence_number INT;
  v_generated_count INT := 0;
  v_location_name TEXT;
  v_title TEXT;
BEGIN
  -- Loop through active contracts
  FOR v_contract IN
    SELECT * FROM service_contracts
    WHERE tenant_id = p_tenant_id
      AND status = 'active'
  LOOP
    -- Loop through line items that need generation
    FOR v_line_item IN
      SELECT * FROM service_contract_line_items
      WHERE contract_id = v_contract.id
        AND next_generation_date BETWEEN p_start_date AND p_end_date
        AND (recurrence_frequency != 'one_time' OR next_generation_date IS NOT NULL)
    LOOP
      v_generation_date := v_line_item.next_generation_date;
      
      -- Get location name if available
      v_location_name := NULL;
      IF v_line_item.location_id IS NOT NULL THEN
        SELECT name INTO v_location_name
        FROM customer_locations
        WHERE id = v_line_item.location_id;
      END IF;
      
      -- Check if service order already exists for this date, contract, AND location
      SELECT id INTO v_service_order_id
      FROM service_orders
      WHERE tenant_id = p_tenant_id
        AND contract_id = v_contract.id
        AND generated_from_date = v_generation_date
        AND (
          (location_id IS NULL AND v_line_item.location_id IS NULL) 
          OR location_id = v_line_item.location_id
        )
      LIMIT 1;
      
      -- Create new service order if none exists for this date + location combination
      IF v_service_order_id IS NULL THEN
        -- Generate work order number
        SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
        INTO v_sequence_number
        FROM service_orders
        WHERE tenant_id = p_tenant_id;
        
        v_work_order_number := 'SO-' || LPAD(v_sequence_number::TEXT, 6, '0');
        
        -- Build title with location info
        v_title := v_contract.contract_name;
        IF v_location_name IS NOT NULL THEN
          v_title := v_title || ' - ' || v_location_name;
        END IF;
        
        -- Create service order
        INSERT INTO service_orders (
          tenant_id,
          work_order_number,
          title,
          description,
          customer_id,
          location_id,
          contract_id,
          generated_from_date,
          status,
          priority,
          scheduled_start_date,
          created_by
        ) VALUES (
          p_tenant_id,
          v_work_order_number,
          v_title,
          'Generated from contract: ' || v_contract.contract_name || 
            CASE WHEN v_location_name IS NOT NULL THEN ' at ' || v_location_name ELSE '' END,
          v_contract.customer_id,
          v_line_item.location_id,  -- Use line item's location
          v_contract.id,
          v_generation_date,
          'draft',
          'medium',
          v_generation_date,
          p_user_id
        )
        RETURNING id INTO v_service_order_id;
      END IF;
      
      -- Add line item to service order
      INSERT INTO service_order_line_items (
        tenant_id,
        service_order_id,
        description,
        quantity,
        unit_price,
        line_total,
        item_order,
        contract_line_item_id
      ) VALUES (
        p_tenant_id,
        v_service_order_id,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.line_total,
        (SELECT COALESCE(MAX(item_order), 0) + 1 FROM service_order_line_items WHERE service_order_id = v_service_order_id),
        v_line_item.id
      );
      
      -- Update next generation date
      UPDATE service_contract_line_items
      SET next_generation_date = calculate_next_generation_date(
        v_generation_date,
        recurrence_frequency::text,
        EXTRACT(DAY FROM v_generation_date)::integer
      )
      WHERE id = v_line_item.id;
      
      v_generated_count := v_generated_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'generated_count', v_generated_count,
    'message', v_generated_count || ' service order line items generated'
  );
END;
$$;