-- Create function to insert purchase order with linkage
CREATE OR REPLACE FUNCTION create_purchase_order_with_linkage(
  p_tenant_id UUID,
  p_supplier_id UUID,
  p_po_number TEXT,
  p_po_date DATE,
  p_expected_delivery_date DATE,
  p_notes TEXT,
  p_internal_notes TEXT,
  p_tax_rate NUMERIC,
  p_subtotal NUMERIC,
  p_tax_amount NUMERIC,
  p_total_amount NUMERIC,
  p_created_by UUID,
  p_status TEXT,
  p_service_order_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po_id UUID;
BEGIN
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
    p_tenant_id,
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
    p_created_by,
    p_status,
    p_service_order_id,
    p_project_id
  )
  RETURNING id INTO v_po_id;
  
  RETURN v_po_id;
END;
$$;