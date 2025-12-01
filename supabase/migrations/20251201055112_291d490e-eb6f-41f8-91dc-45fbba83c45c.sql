-- Update the generate_service_orders_from_contracts function to use proper sequential numbering
CREATE OR REPLACE FUNCTION generate_service_orders_from_contracts(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_user_id UUID DEFAULT NULL
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
  v_order_number TEXT;
  v_total_generated INTEGER := 0;
  v_results JSON[] := ARRAY[]::JSON[];
  v_generation_date DATE;
BEGIN
  -- Loop through all active contracts
  FOR v_contract IN
    SELECT sc.*
    FROM service_contracts sc
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND sc.start_date <= p_end_date
      AND (sc.end_date IS NULL OR sc.end_date >= p_start_date)
  LOOP
    -- Loop through line items that need generation
    FOR v_line_item IN
      SELECT scli.*
      FROM service_contract_line_items scli
      WHERE scli.contract_id = v_contract.id
        AND scli.next_generation_date IS NOT NULL
        AND scli.next_generation_date BETWEEN p_start_date AND p_end_date
      ORDER BY scli.next_generation_date, scli.item_order
    LOOP
      v_generation_date := v_line_item.next_generation_date;
      
      -- Check if service order already exists for this date and contract
      SELECT id INTO v_service_order_id
      FROM service_orders
      WHERE tenant_id = p_tenant_id
        AND contract_id = v_contract.id
        AND scheduled_date = v_generation_date
      LIMIT 1;
      
      -- Create new service order if it doesn't exist
      IF v_service_order_id IS NULL THEN
        -- Get the next sequential order number
        v_order_number := get_next_sequential_number(p_tenant_id, 'service_order');
        
        INSERT INTO service_orders (
          tenant_id,
          contract_id,
          customer_id,
          location_id,
          order_number,
          work_order_number,
          title,
          description,
          status,
          priority,
          scheduled_date,
          created_by
        ) VALUES (
          p_tenant_id,
          v_contract.id,
          v_contract.customer_id,
          v_contract.location_id,
          v_order_number,
          NULL,  -- Work order number is customer-provided, leave empty
          v_contract.title,
          'Auto-generated from contract: ' || v_contract.contract_number,
          'pending',
          v_contract.default_priority,
          v_generation_date,
          COALESCE(p_user_id, v_contract.created_by)
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
        price_book_item_id,
        is_from_price_book
      ) VALUES (
        p_tenant_id,
        v_service_order_id,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.line_total,
        v_line_item.item_order,
        v_line_item.price_book_item_id,
        v_line_item.is_from_price_book
      )
      ON CONFLICT DO NOTHING;
      
      -- Update next generation date
      UPDATE service_contract_line_items
      SET next_generation_date = calculate_next_generation_date(
        v_line_item.next_generation_date,
        v_line_item.recurrence_frequency::text,
        EXTRACT(DAY FROM v_line_item.next_generation_date)::integer
      )
      WHERE id = v_line_item.id;
      
      v_total_generated := v_total_generated + 1;
      
      -- Add to results
      v_results := array_append(v_results, json_build_object(
        'service_order_id', v_service_order_id,
        'order_number', v_order_number,
        'contract_number', v_contract.contract_number,
        'generation_date', v_generation_date
      ));
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'total_generated', v_total_generated,
    'service_orders', array_to_json(v_results)
  );
END;
$$;