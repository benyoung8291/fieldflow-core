-- Force complete refresh of linking functions with explicit schema and VOLATILE
-- This ensures PostgreSQL doesn't use any cached schema information

DROP FUNCTION IF EXISTS link_purchase_order_to_service_order(UUID, UUID);
DROP FUNCTION IF EXISTS link_purchase_order_to_project(UUID, UUID);

-- Recreate with VOLATILE to prevent caching and explicit public schema
CREATE OR REPLACE FUNCTION public.link_purchase_order_to_service_order(
  p_po_id UUID,
  p_service_order_id UUID
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Explicitly reference the public schema and use a fresh table reference
  UPDATE public.purchase_orders
  SET 
    service_order_id = p_service_order_id,
    project_id = NULL,
    updated_at = now()
  WHERE id = p_po_id
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found or access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_purchase_order_to_project(
  p_po_id UUID,
  p_project_id UUID
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Explicitly reference the public schema and use a fresh table reference
  UPDATE public.purchase_orders
  SET 
    project_id = p_project_id,
    service_order_id = NULL,
    updated_at = now()
  WHERE id = p_po_id
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found or access denied';
  END IF;
END;
$$;