-- Create function to get all purchase orders (for list views)
CREATE OR REPLACE FUNCTION get_all_purchase_orders(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  po_number TEXT,
  supplier_id UUID,
  status TEXT,
  po_date DATE,
  expected_delivery_date DATE,
  subtotal NUMERIC,
  tax_rate NUMERIC,
  tax_amount NUMERIC,
  total_amount NUMERIC,
  payment_terms INTEGER,
  notes TEXT,
  internal_notes TEXT,
  project_id UUID,
  service_order_id UUID,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  policy_violations JSONB,
  is_policy_compliant BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.tenant_id,
    po.po_number,
    po.supplier_id,
    po.status,
    po.po_date,
    po.expected_delivery_date,
    po.subtotal,
    po.tax_rate,
    po.tax_amount,
    po.total_amount,
    po.payment_terms,
    po.notes,
    po.internal_notes,
    po.project_id,
    po.service_order_id,
    po.created_by,
    po.approved_by,
    po.approved_at,
    po.created_at,
    po.updated_at,
    po.policy_violations,
    po.is_policy_compliant
  FROM purchase_orders po
  WHERE po.tenant_id = p_tenant_id
  ORDER BY po.created_at DESC;
END;
$$;