-- Fix security warnings by setting search_path on linking functions
CREATE OR REPLACE FUNCTION link_purchase_order_to_service_order(
  p_po_id UUID,
  p_service_order_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE purchase_orders
  SET 
    service_order_id = p_service_order_id,
    project_id = NULL,
    updated_at = now()
  WHERE id = p_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION link_purchase_order_to_project(
  p_po_id UUID,
  p_project_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE purchase_orders
  SET 
    project_id = p_project_id,
    service_order_id = NULL,
    updated_at = now()
  WHERE id = p_po_id;
END;
$$;