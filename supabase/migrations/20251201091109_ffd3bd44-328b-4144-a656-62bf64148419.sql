-- Fix existing service orders created from contracts
DO $$
DECLARE
  v_service_order RECORD;
  v_generation_history RECORD;
  v_contract_line_item RECORD;
  v_new_number TEXT;
  v_line_item_cost NUMERIC;
BEGIN
  -- Loop through service orders that were created from contracts
  FOR v_service_order IN
    SELECT DISTINCT so.id, so.tenant_id, so.contract_id, so.work_order_number, so.created_at
    FROM service_orders so
    WHERE so.contract_id IS NOT NULL
      AND (so.work_order_number LIKE '%-%-%' OR so.work_order_number NOT LIKE 'SO-%')
    ORDER BY so.created_at
  LOOP
    -- Get a new sequential number
    v_new_number := get_next_sequential_number(v_service_order.tenant_id, 'service_order');
    
    -- Update the service order number
    UPDATE service_orders
    SET 
      work_order_number = v_new_number,
      order_number = v_new_number
    WHERE id = v_service_order.id;
    
    -- Find the generation history for this service order
    FOR v_generation_history IN
      SELECT * FROM service_contract_generation_history
      WHERE service_order_id = v_service_order.id
    LOOP
      -- Get the contract line item details
      SELECT * INTO v_contract_line_item
      FROM service_contract_line_items
      WHERE id = v_generation_history.contract_line_item_id;
      
      IF v_contract_line_item.id IS NOT NULL THEN
        -- Calculate line item cost
        v_line_item_cost := v_contract_line_item.quantity * v_contract_line_item.unit_price;
        
        -- Check if line item already exists
        IF NOT EXISTS (
          SELECT 1 FROM service_order_line_items
          WHERE service_order_id = v_service_order.id
            AND contract_line_item_id = v_contract_line_item.id
        ) THEN
          -- Create the missing line item
          INSERT INTO service_order_line_items (
            tenant_id,
            service_order_id,
            description,
            quantity,
            unit_price,
            line_total,
            estimated_hours,
            cost_price,
            item_order,
            is_gst_free,
            contract_line_item_id,
            generation_date
          ) VALUES (
            v_service_order.tenant_id,
            v_service_order.id,
            v_contract_line_item.description,
            v_contract_line_item.quantity,
            v_contract_line_item.unit_price,
            v_line_item_cost,
            COALESCE(v_contract_line_item.estimated_hours, 0),
            COALESCE(v_contract_line_item.cost_price, 0),
            0,
            false,
            v_contract_line_item.id,
            v_generation_history.generation_date
          );
        END IF;
        
        -- Update service order totals
        UPDATE service_orders
        SET 
          subtotal = v_line_item_cost,
          total_amount = v_line_item_cost
        WHERE id = v_service_order.id;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Fixed existing service orders created from contracts';
END $$;