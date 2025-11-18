-- Create a database function to insert purchase orders
-- This bypasses PostgREST schema cache issues

CREATE OR REPLACE FUNCTION create_purchase_order(
  p_supplier_id uuid,
  p_po_number text,
  p_po_date date,
  p_expected_delivery_date date,
  p_notes text,
  p_internal_notes text,
  p_tax_rate numeric,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_total_amount numeric,
  p_service_order_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_po_id uuid;
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User has no tenant';
  END IF;

  -- Insert purchase order
  INSERT INTO purchase_orders (
    tenant_id,
    supplier_id,
    po_number,
    po_date,
    expected_delivery_date,
    notes,
    internal_notes,
    tax_rate,
    subtotal,
    tax_amount,
    total_amount,
    created_by,
    status,
    service_order_id,
    project_id
  ) VALUES (
    v_tenant_id,
    p_supplier_id,
    p_po_number,
    p_po_date,
    p_expected_delivery_date,
    p_notes,
    p_internal_notes,
    p_tax_rate,
    p_subtotal,
    p_tax_amount,
    p_total_amount,
    v_user_id,
    'draft',
    p_service_order_id,
    p_project_id
  )
  RETURNING id INTO v_po_id;

  RETURN v_po_id;
END;
$$;