-- Add facility_manager_contact_id to service_orders table
ALTER TABLE service_orders 
ADD COLUMN facility_manager_contact_id uuid REFERENCES contacts(id);

-- Add comments to clarify contact fields
COMMENT ON COLUMN service_orders.customer_contact_id IS 'Site contact/manager for the service order';
COMMENT ON COLUMN service_orders.facility_manager_contact_id IS 'Facility manager contact for the service order';

-- Update the generate_service_orders_from_contracts function to properly handle locations and contacts
CREATE OR REPLACE FUNCTION generate_service_orders_from_contracts(
  p_start_date DATE,
  p_end_date DATE,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_line_item RECORD;
  v_service_order_id UUID;
  v_work_order_number TEXT;
  v_generated_count INTEGER := 0;
  v_tenant_id UUID;
  v_site_contact_id UUID;
  v_facility_manager_contact_id UUID;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = p_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not found or has no tenant';
  END IF;

  -- Loop through active contracts
  FOR v_contract IN
    SELECT * FROM service_contracts
    WHERE tenant_id = v_tenant_id
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

      -- Create service order
      INSERT INTO service_orders (
        tenant_id,
        customer_id,
        customer_location_id,
        customer_contact_id,
        facility_manager_contact_id,
        contract_id,
        contract_line_item_id,
        title,
        description,
        work_order_number,
        status,
        priority,
        billing_type,
        created_by
      ) VALUES (
        v_tenant_id,
        v_contract.customer_id,
        v_line_item.location_id,
        v_site_contact_id,
        v_facility_manager_contact_id,
        v_contract.id,
        v_line_item.id,
        v_line_item.description,
        v_contract.description,
        v_work_order_number,
        'draft',
        'normal',
        'recurring',
        p_user_id
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
        v_tenant_id,
        v_line_item.description,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.quantity * v_line_item.unit_price,
        v_line_item.estimated_hours,
        0
      );

      -- Update next generation date
      UPDATE service_contract_line_items
      SET next_generation_date = calculate_next_generation_date(
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