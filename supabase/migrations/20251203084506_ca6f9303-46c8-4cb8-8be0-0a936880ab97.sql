
CREATE OR REPLACE FUNCTION public.generate_service_orders_from_contracts(p_tenant_id uuid, p_start_date date, p_end_date date, p_created_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_group RECORD;
  v_line_item RECORD;
  v_service_order_id UUID;
  v_existing_order_id UUID;
  v_total_generated INT := 0;
  v_total_line_items INT := 0;
  v_already_generated INT := 0;
  v_work_order_number TEXT;
  v_group_total NUMERIC;
  v_group_title TEXT;
  v_line_item_order INT;
BEGIN
  -- First, iterate over unique groups of (location_id, next_generation_date, contract_id, customer_id)
  FOR v_group IN
    SELECT 
      scli.location_id,
      scli.next_generation_date,
      sc.id as contract_id,
      sc.contract_number,
      sc.customer_id,
      sc.title as contract_title
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND scli.next_generation_date IS NOT NULL
      AND scli.next_generation_date >= p_start_date
      AND scli.next_generation_date <= p_end_date
    GROUP BY scli.location_id, scli.next_generation_date, sc.id, sc.contract_number, sc.customer_id, sc.title
    ORDER BY sc.contract_number, scli.next_generation_date
  LOOP
    -- Check if a service order already exists for this group (location + date + contract)
    SELECT so.id INTO v_existing_order_id
    FROM service_orders so
    WHERE so.tenant_id = p_tenant_id
      AND so.contract_id = v_group.contract_id
      AND so.customer_location_id = v_group.location_id
      AND so.generated_from_date = v_group.next_generation_date
    LIMIT 1;
    
    IF v_existing_order_id IS NOT NULL THEN
      -- Count how many line items would have been in this group for reporting
      SELECT COUNT(*) INTO v_total_line_items
      FROM service_contract_line_items scli
      WHERE scli.contract_id = v_group.contract_id
        AND scli.location_id = v_group.location_id
        AND scli.next_generation_date = v_group.next_generation_date;
      
      v_already_generated := v_already_generated + v_total_line_items;
      CONTINUE;
    END IF;
    
    -- Calculate total for this group
    SELECT COALESCE(SUM(scli.quantity * scli.unit_price), 0)
    INTO v_group_total
    FROM service_contract_line_items scli
    WHERE scli.contract_id = v_group.contract_id
      AND scli.location_id = v_group.location_id
      AND scli.next_generation_date = v_group.next_generation_date;
    
    -- Build service order title from contract title + month name
    v_group_title := COALESCE(v_group.contract_title, 'Service Order') || ' - ' || TRIM(TO_CHAR(v_group.next_generation_date, 'Month'));
    
    -- Get next sequential service order number
    v_work_order_number := get_next_sequential_number(p_tenant_id, 'service_order');
    
    -- Create ONE service order for this group
    INSERT INTO service_orders (
      tenant_id,
      work_order_number,
      order_number,
      title,
      description,
      customer_id,
      customer_location_id,
      contract_id,
      preferred_date,
      generated_from_date,
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
      v_group_title,
      'Auto-generated from contract: ' || v_group.contract_number,
      v_group.customer_id,
      v_group.location_id,
      v_group.contract_id,
      v_group.next_generation_date,
      v_group.next_generation_date,
      'draft',
      'normal',
      'fixed',
      p_created_by,
      v_group_total,
      v_group_total
    )
    RETURNING id INTO v_service_order_id;
    
    v_total_generated := v_total_generated + 1;
    
    -- Now insert line items for this service order
    v_line_item_order := 0;
    FOR v_line_item IN
      SELECT 
        scli.id as contract_line_item_id,
        scli.description,
        scli.quantity,
        scli.unit_price,
        scli.recurrence_frequency
      FROM service_contract_line_items scli
      WHERE scli.contract_id = v_group.contract_id
        AND scli.location_id = v_group.location_id
        AND scli.next_generation_date = v_group.next_generation_date
      ORDER BY scli.item_order
    LOOP
      v_line_item_order := v_line_item_order + 1;
      
      INSERT INTO service_order_line_items (
        tenant_id,
        service_order_id,
        description,
        quantity,
        unit_price,
        line_total,
        item_order,
        source_contract_line_item_id
      ) VALUES (
        p_tenant_id,
        v_service_order_id,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.quantity * v_line_item.unit_price,
        v_line_item_order,
        v_line_item.contract_line_item_id
      );
      
      v_total_line_items := v_total_line_items + 1;
      
      -- Update the next_generation_date for this line item
      UPDATE service_contract_line_items
      SET next_generation_date = calculate_next_generation_date(v_group.next_generation_date, recurrence_frequency)
      WHERE id = v_line_item.contract_line_item_id;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'service_orders_created', v_total_generated,
    'line_items_created', v_total_line_items,
    'already_generated', v_already_generated
  );
END;
$function$;
