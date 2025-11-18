-- Update function to include tenant security check
CREATE OR REPLACE FUNCTION update_purchase_order_linkage(
  p_po_id UUID,
  p_service_order_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get the user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User has no tenant';
  END IF;
  
  -- Update the purchase order with the new linkage
  -- Only update if it belongs to the user's tenant
  UPDATE purchase_orders
  SET 
    service_order_id = p_service_order_id,
    project_id = p_project_id,
    updated_at = now()
  WHERE id = p_po_id
    AND tenant_id = v_tenant_id;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found or access denied';
  END IF;
END;
$$;