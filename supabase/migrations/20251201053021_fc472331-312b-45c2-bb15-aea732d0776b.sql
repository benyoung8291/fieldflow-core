-- Fix 1: Update generate_service_orders_from_contracts function
-- Remove non-existent contract_line_item_id column reference
CREATE OR REPLACE FUNCTION generate_service_orders_from_contracts(
  p_start_date date,
  p_end_date date,
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_contract RECORD;
  v_line_item RECORD;
  v_service_order_id UUID;
  v_work_order_number TEXT;
  v_generated_count INTEGER := 0;
  v_site_contact_id UUID;
  v_facility_manager_contact_id UUID;
BEGIN
  -- Loop through active contracts for this tenant
  FOR v_contract IN
    SELECT * FROM service_contracts
    WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND (end_date IS NULL OR end_date >= p_start_date)
  LOOP
    -- Loop through line items that need generation
    FOR v_line_item IN
      SELECT * FROM service_contract_line_items
      WHERE contract_id = v_contract.id
      AND is_active = true
      AND next_generation_date IS NOT NULL
      AND next_generation_date BETWEEN p_start_date AND p_end_date
    LOOP
      -- Get contacts from location if available
      v_site_contact_id := NULL;
      v_facility_manager_contact_id := NULL;
      
      IF v_line_item.location_id IS NOT NULL THEN
        SELECT site_contact_id, facility_manager_contact_id 
        INTO v_site_contact_id, v_facility_manager_contact_id
        FROM customer_locations 
        WHERE id = v_line_item.location_id;
      END IF;

      -- Generate work order number
      v_work_order_number := 'SO-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0');

      -- Create service order (without contract_line_item_id)
      INSERT INTO service_orders (
        tenant_id,
        customer_id,
        customer_location_id,
        customer_contact_id,
        facility_manager_contact_id,
        contract_id,
        title,
        description,
        work_order_number,
        status,
        priority,
        billing_type,
        created_by,
        generated_from_date
      ) VALUES (
        p_tenant_id,
        v_contract.customer_id,
        v_line_item.location_id,
        v_site_contact_id,
        v_facility_manager_contact_id,
        v_contract.id,
        v_line_item.description,
        v_contract.description,
        v_work_order_number,
        'draft',
        'normal',
        'recurring',
        p_user_id,
        v_line_item.next_generation_date
      ) RETURNING id INTO v_service_order_id;

      -- Create line item for the service order
      INSERT INTO service_order_line_items (
        service_order_id,
        tenant_id,
        description,
        quantity,
        unit_price,
        line_total,
        estimated_hours,
        item_order
      ) VALUES (
        v_service_order_id,
        p_tenant_id,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.quantity * v_line_item.unit_price,
        v_line_item.estimated_hours,
        0
      );

      -- Update the contract line item: set last_generated_date and calculate next_generation_date
      UPDATE service_contract_line_items
      SET 
        last_generated_date = v_line_item.next_generation_date,
        next_generation_date = calculate_next_generation_date(
          v_line_item.next_generation_date,
          v_line_item.recurrence_frequency::text
        )
      WHERE id = v_line_item.id;

      v_generated_count := v_generated_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'generated_count', v_generated_count
  );
END;
$$;

-- Fix 2: Update set_line_item_next_generation_date trigger function
-- Use first_generation_date instead of contract start_date
CREATE OR REPLACE FUNCTION set_line_item_next_generation_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Only set next_generation_date if it's NULL AND first_generation_date is set
  IF NEW.next_generation_date IS NULL AND NEW.first_generation_date IS NOT NULL THEN
    NEW.next_generation_date := NEW.first_generation_date;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix 3: Correct existing corrupted data
-- Update line items where next_generation_date is before first_generation_date
-- (only when no orders have been generated yet)
UPDATE service_contract_line_items
SET next_generation_date = first_generation_date
WHERE last_generated_date IS NULL
AND first_generation_date IS NOT NULL
AND (next_generation_date IS NULL OR next_generation_date < first_generation_date);