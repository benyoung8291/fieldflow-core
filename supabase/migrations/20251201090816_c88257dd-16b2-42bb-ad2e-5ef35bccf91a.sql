-- Fix generate_service_orders_from_contracts to use sequential numbering and create line items
DROP FUNCTION IF EXISTS generate_service_orders_from_contracts(uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION generate_service_orders_from_contracts(
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_line_item RECORD;
  v_contract RECORD;
  v_generation_date DATE;
  v_service_order_id UUID;
  v_existing_order_id UUID;
  v_total_generated INT := 0;
  v_total_line_items INT := 0;
  v_already_generated INT := 0;
  v_work_order_number TEXT;
  v_line_item_cost NUMERIC;
  v_total_cost NUMERIC;
BEGIN
  FOR v_line_item IN
    SELECT 
      scli.*,
      sc.contract_number,
      sc.customer_id
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND scli.next_generation_date IS NOT NULL
      AND scli.next_generation_date >= p_start_date
      AND scli.next_generation_date <= p_end_date
    ORDER BY sc.contract_number, scli.next_generation_date, scli.item_order
  LOOP
    v_total_line_items := v_total_line_items + 1;
    v_generation_date := v_line_item.next_generation_date;
    
    -- Check if service order already exists for this date and contract line item
    SELECT service_order_id INTO v_existing_order_id
    FROM service_contract_generation_history
    WHERE tenant_id = p_tenant_id
      AND contract_line_item_id = v_line_item.id
      AND generation_date = v_generation_date
    LIMIT 1;
    
    IF v_existing_order_id IS NOT NULL THEN
      v_already_generated := v_already_generated + 1;
    ELSE
      -- Calculate line item cost
      v_line_item_cost := v_line_item.quantity * v_line_item.unit_price;
      
      -- Get next sequential service order number
      v_work_order_number := get_next_sequential_number(p_tenant_id, 'service_order');
      
      -- Create service order
      INSERT INTO service_orders (
        tenant_id,
        work_order_number,
        order_number,
        title,
        description,
        customer_id,
        location_id,
        contract_id,
        preferred_date,
        status,
        priority,
        billing_type,
        created_by,
        subtotal,
        total_amount
      ) VALUES (
        p_tenant_id,
        v_work_order_number,
        v_work_order_number,
        v_line_item.description,
        'Auto-generated from contract: ' || v_line_item.contract_number,
        v_line_item.customer_id,
        v_line_item.location_id,
        v_line_item.contract_id,
        v_generation_date,
        'draft',
        'normal',
        'fixed',
        p_created_by,
        v_line_item_cost,
        v_line_item_cost
      )
      RETURNING id INTO v_service_order_id;
      
      -- Create service order line item
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
        p_tenant_id,
        v_service_order_id,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item_cost,
        COALESCE(v_line_item.estimated_hours, 0),
        COALESCE(v_line_item.cost_price, 0),
        0,
        false,
        v_line_item.id,
        v_generation_date
      );
      
      -- Log generation in history
      INSERT INTO service_contract_generation_history (
        tenant_id,
        contract_id,
        contract_line_item_id,
        generation_date,
        service_order_id,
        generated_by
      ) VALUES (
        p_tenant_id,
        v_line_item.contract_id,
        v_line_item.id,
        v_generation_date,
        v_service_order_id,
        p_created_by
      );
      
      -- Update next_generation_date
      UPDATE service_contract_line_items
      SET next_generation_date = calculate_next_generation_date(
        v_generation_date,
        recurrence_frequency::text,
        EXTRACT(DAY FROM v_generation_date)::integer
      )
      WHERE id = v_line_item.id;
      
      v_total_generated := v_total_generated + 1;
      
      -- Create audit log
      INSERT INTO audit_logs (
        tenant_id,
        table_name,
        record_id,
        action,
        user_name,
        user_id,
        note
      ) VALUES (
        p_tenant_id,
        'service_orders',
        v_service_order_id,
        'create',
        'System',
        p_created_by,
        'Auto-generated from contract line item'
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'orders_created', v_total_generated,
      'total_line_items', v_total_line_items,
      'already_generated', v_already_generated
    )
  );
END;
$$;