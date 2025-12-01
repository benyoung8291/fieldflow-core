-- Fix audit log action in generate_service_orders_from_contracts function
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
  v_contract_number TEXT;
  v_work_order_number TEXT;
  v_sequence_number INT;
  v_line_item_cost NUMERIC;
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
    v_generation_date := v_line_item.next_generation_date;
    
    -- Check if service order already exists for this date and contract line item
    SELECT service_order_id INTO v_existing_order_id
    FROM service_contract_generation_history
    WHERE tenant_id = p_tenant_id
      AND contract_line_item_id = v_line_item.id
      AND generation_date = v_generation_date
    LIMIT 1;
    
    IF v_existing_order_id IS NULL THEN
      -- Calculate line item cost
      v_line_item_cost := v_line_item.quantity * v_line_item.unit_price;
      
      -- Get next sequence number for this contract
      SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM '-([0-9]+)$') AS INTEGER)), 0) + 1
      INTO v_sequence_number
      FROM service_orders
      WHERE tenant_id = p_tenant_id
        AND contract_id = v_line_item.contract_id;
      
      -- Generate work order number
      v_work_order_number := v_line_item.contract_number || '-' || v_sequence_number;
      
      -- Create service order
      INSERT INTO service_orders (
        tenant_id,
        work_order_number,
        title,
        description,
        customer_id,
        location_id,
        contract_id,
        preferred_date,
        status,
        priority,
        billing_type,
        fixed_amount,
        created_by,
        order_number
      ) VALUES (
        p_tenant_id,
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
        v_line_item_cost,
        p_created_by,
        v_work_order_number
      )
      RETURNING id INTO v_service_order_id;
      
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
      
      -- Create audit log with correct action value
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
    'success', true,
    'total_generated', v_total_generated
  );
END;
$$;