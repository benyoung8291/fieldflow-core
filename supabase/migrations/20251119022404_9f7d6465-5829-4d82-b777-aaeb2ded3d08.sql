-- Drop and recreate the service order linking function to force schema refresh
DROP FUNCTION IF EXISTS public.link_purchase_order_to_service_order(UUID, UUID);

-- Recreate with explicit public schema qualification and volatile to prevent caching
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
  -- Explicitly reference the public schema to force current schema usage
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