-- Fix the generate_service_orders_from_contracts function to use valid enum status
-- The function is currently using 'pending' which is not a valid service_order_status enum value
-- Valid values are: draft, scheduled, in_progress, completed, cancelled

CREATE OR REPLACE FUNCTION generate_service_orders_from_contracts(
  p_start_date DATE,
  p_end_date DATE,
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_line_item RECORD;
  v_contract RECORD;
  v_service_order_id UUID;
  v_orders_created INT := 0;
  v_total_line_items INT := 0;
  v_already_generated INT := 0;
  v_work_order_number TEXT;
  v_errors JSONB := '[]'::JSONB;
  v_orders JSONB := '[]'::JSONB;
BEGIN
  -- Loop through all active contracts for this tenant
  FOR v_contract IN
    SELECT * FROM service_contracts
    WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND (end_date IS NULL OR end_date >= p_start_date)
  LOOP
    -- Loop through line items for this contract
    FOR v_line_item IN
      SELECT * FROM service_contract_line_items
      WHERE contract_id = v_contract.id
      AND next_generation_date >= p_start_date
      AND next_generation_date <= p_end_date
      AND recurrence_frequency != 'one_time'
      ORDER BY next_generation_date
    LOOP
      v_total_line_items := v_total_line_items + 1;
      
      -- Check if service order already exists for this date and line item
      IF EXISTS (
        SELECT 1 FROM service_orders
        WHERE contract_id = v_contract.id
        AND contract_line_item_id = v_line_item.id
        AND scheduled_date = v_line_item.next_generation_date
      ) THEN
        v_already_generated := v_already_generated + 1;
        CONTINUE;
      END IF;
      
      BEGIN
        -- Generate work order number
        v_work_order_number := 'SO-' || EXTRACT(YEAR FROM v_line_item.next_generation_date) || 
                               '-' || LPAD(EXTRACT(MONTH FROM v_line_item.next_generation_date)::TEXT, 2, '0') || 
                               '-' || LPAD((v_orders_created + 1)::TEXT, 4, '0');
        
        -- Create service order with 'draft' status instead of 'pending'
        INSERT INTO service_orders (
          tenant_id,
          work_order_number,
          customer_id,
          location_id,
          contract_id,
          contract_line_item_id,
          status,
          scheduled_date,
          description,
          estimated_hours,
          created_by
        ) VALUES (
          p_tenant_id,
          v_work_order_number,
          v_contract.customer_id,
          v_contract.location_id,
          v_contract.id,
          v_line_item.id,
          'draft', -- Changed from 'pending' to 'draft'
          v_line_item.next_generation_date,
          v_line_item.description,
          v_line_item.estimated_hours,
          p_user_id
        )
        RETURNING id INTO v_service_order_id;
        
        v_orders_created := v_orders_created + 1;
        
        -- Update next_generation_date for the line item
        UPDATE service_contract_line_items
        SET next_generation_date = calculate_next_generation_date(
          next_generation_date,
          recurrence_frequency::text,
          EXTRACT(DAY FROM next_generation_date)::integer
        )
        WHERE id = v_line_item.id;
        
        -- Add to orders array
        v_orders := v_orders || jsonb_build_object(
          'id', v_service_order_id,
          'work_order_number', v_work_order_number,
          'scheduled_date', v_line_item.next_generation_date,
          'description', v_line_item.description
        );
        
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'line_item_id', v_line_item.id,
          'error', SQLERRM
        );
      END;
    END LOOP;
  END LOOP;
  
  v_result := jsonb_build_object(
    'summary', jsonb_build_object(
      'orders_created', v_orders_created,
      'total_line_items', v_total_line_items,
      'already_generated', v_already_generated
    ),
    'orders', v_orders,
    'errors', v_errors
  );
  
  RETURN v_result;
END;
$$;