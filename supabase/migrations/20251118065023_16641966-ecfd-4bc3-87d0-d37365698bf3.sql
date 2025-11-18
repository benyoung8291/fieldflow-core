-- Fix function with explicit schema qualification
CREATE OR REPLACE FUNCTION update_purchase_order_linkage(
  p_po_id UUID,
  p_service_order_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Update the purchase order with fully qualified table name
  UPDATE public.purchase_orders
  SET 
    service_order_id = p_service_order_id,
    project_id = p_project_id,
    updated_at = now()
  WHERE id = p_po_id;
END;
$$;