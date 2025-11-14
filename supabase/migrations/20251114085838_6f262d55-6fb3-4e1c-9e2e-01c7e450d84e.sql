-- Add variance approval workflow columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS requires_manager_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approval_requested_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS manager_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS manager_approval_notes text,
ADD COLUMN IF NOT EXISTS approval_status text CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';

-- Create AP invoice settings table
CREATE TABLE IF NOT EXISTS ap_invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variance_threshold_percentage numeric NOT NULL DEFAULT 10.0,
  require_manager_approval_above_threshold boolean NOT NULL DEFAULT true,
  auto_approve_within_threshold boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS on ap_invoice_settings
ALTER TABLE ap_invoice_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for ap_invoice_settings
CREATE POLICY "Users can view AP settings in their tenant"
  ON ap_invoice_settings FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage AP settings in their tenant"
  ON ap_invoice_settings FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

-- Function to check if variance requires approval
CREATE OR REPLACE FUNCTION check_variance_requires_approval(
  p_invoice_id uuid,
  p_total_variance numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_settings record;
  v_variance_percentage numeric;
  v_invoice_total numeric;
BEGIN
  -- Get invoice details
  SELECT tenant_id, total_amount INTO v_tenant_id, v_invoice_total
  FROM invoices
  WHERE id = p_invoice_id;

  -- Get settings
  SELECT * INTO v_settings
  FROM ap_invoice_settings
  WHERE tenant_id = v_tenant_id;

  -- If no settings exist, use default threshold of 10%
  IF v_settings IS NULL THEN
    v_settings.variance_threshold_percentage := 10.0;
    v_settings.require_manager_approval_above_threshold := true;
  END IF;

  -- Calculate variance percentage
  IF v_invoice_total > 0 THEN
    v_variance_percentage := ABS(p_total_variance / v_invoice_total * 100);
  ELSE
    v_variance_percentage := 0;
  END IF;

  -- Check if approval is required
  IF v_settings.require_manager_approval_above_threshold AND 
     v_variance_percentage > v_settings.variance_threshold_percentage THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Function to request manager approval
CREATE OR REPLACE FUNCTION request_ap_invoice_approval(
  p_invoice_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM invoices
  WHERE id = p_invoice_id;

  -- Verify user has access
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_user_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'User does not have access to this invoice';
  END IF;

  -- Update invoice to request approval
  UPDATE invoices
  SET 
    requires_manager_approval = true,
    approval_requested_at = now(),
    approval_requested_by = v_user_id,
    approval_status = 'pending',
    manager_approval_notes = p_notes
  WHERE id = p_invoice_id;

  -- Create notification for managers
  INSERT INTO notifications (
    tenant_id,
    user_id,
    type,
    title,
    message,
    link,
    created_at
  )
  SELECT 
    v_tenant_id,
    p.id,
    'approval_request',
    'AP Invoice Approval Required',
    'Invoice with variance above threshold requires your approval',
    '/invoices/' || p_invoice_id,
    now()
  FROM profiles p
  WHERE p.tenant_id = v_tenant_id 
    AND p.user_role IN ('tenant_admin', 'supervisor');

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Approval request sent to managers'
  );

  RETURN v_result;
END;
$$;

-- Function to approve/reject variance by manager
CREATE OR REPLACE FUNCTION approve_reject_ap_invoice_variance(
  p_invoice_id uuid,
  p_approve boolean,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_new_status text;
  v_new_matching_status text;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM invoices
  WHERE id = p_invoice_id;

  -- Verify user is a manager
  IF NOT has_role(v_user_id, 'tenant_admin') AND 
     NOT has_role(v_user_id, 'supervisor') THEN
    RAISE EXCEPTION 'Only managers can approve/reject invoices';
  END IF;

  -- Determine new status
  IF p_approve THEN
    v_new_status := 'approved';
    v_new_matching_status := 'approved';
  ELSE
    v_new_status := 'rejected';
    v_new_matching_status := 'variance';
  END IF;

  -- Update invoice
  UPDATE invoices
  SET 
    approval_status = v_new_status,
    matching_status = v_new_matching_status,
    manager_approved_by = v_user_id,
    manager_approved_at = now(),
    manager_approval_notes = p_notes
  WHERE id = p_invoice_id;

  -- Create notification for requester
  INSERT INTO notifications (
    tenant_id,
    user_id,
    type,
    title,
    message,
    link,
    created_at
  )
  SELECT 
    v_tenant_id,
    approval_requested_by,
    'approval_decision',
    CASE WHEN p_approve THEN 'AP Invoice Approved' ELSE 'AP Invoice Rejected' END,
    CASE WHEN p_approve THEN 'Your variance approval request has been approved' 
         ELSE 'Your variance approval request has been rejected' END,
    '/invoices/' || p_invoice_id,
    now()
  FROM invoices
  WHERE id = p_invoice_id AND approval_requested_by IS NOT NULL;

  v_result := jsonb_build_object(
    'success', true,
    'message', CASE WHEN p_approve THEN 'Invoice approved for payment' ELSE 'Invoice rejected' END,
    'status', v_new_status
  );

  RETURN v_result;
END;
$$;

-- Update perform_three_way_match to check if approval is required
CREATE OR REPLACE FUNCTION perform_three_way_match(
  p_invoice_id uuid,
  p_tolerance_percentage numeric DEFAULT 5.0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice record;
  v_po_line record;
  v_invoice_line record;
  v_total_variance numeric := 0;
  v_all_matched boolean := true;
  v_matching_status text;
  v_requires_approval boolean := false;
  v_result jsonb;
BEGIN
  -- Get invoice details
  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id AND invoice_type = 'AP';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AP Invoice not found';
  END IF;

  -- Clear existing matching data
  DELETE FROM ap_invoice_line_matching WHERE invoice_id = p_invoice_id;

  -- Match each invoice line with PO line
  FOR v_invoice_line IN 
    SELECT * FROM invoice_line_items 
    WHERE invoice_id = p_invoice_id 
    ORDER BY item_order
  LOOP
    -- Get corresponding PO line (simplified - assumes matching by order)
    SELECT * INTO v_po_line
    FROM purchase_order_line_items
    WHERE purchase_order_id = v_invoice.purchase_order_id
    ORDER BY item_order
    LIMIT 1 OFFSET (
      SELECT COUNT(*) 
      FROM ap_invoice_line_matching 
      WHERE invoice_id = p_invoice_id
    );

    IF FOUND THEN
      DECLARE
        v_qty_variance numeric;
        v_price_variance numeric;
        v_total_line_variance numeric;
        v_is_matched boolean;
        v_tolerance_amount numeric;
      BEGIN
        -- Calculate variances
        v_qty_variance := v_invoice_line.quantity - v_po_line.quantity;
        v_price_variance := v_invoice_line.unit_price - v_po_line.unit_price;
        v_total_line_variance := (v_invoice_line.quantity * v_invoice_line.unit_price) - 
                                  (v_po_line.quantity * v_po_line.unit_price);
        
        v_total_variance := v_total_variance + v_total_line_variance;
        
        -- Check if within tolerance
        v_tolerance_amount := (v_po_line.quantity * v_po_line.unit_price) * (p_tolerance_percentage / 100);
        v_is_matched := ABS(v_total_line_variance) <= v_tolerance_amount;
        
        IF NOT v_is_matched THEN
          v_all_matched := false;
        END IF;

        -- Insert matching record
        INSERT INTO ap_invoice_line_matching (
          tenant_id,
          invoice_id,
          invoice_line_id,
          po_line_id,
          po_quantity,
          invoice_quantity,
          quantity_variance,
          po_unit_price,
          invoice_unit_price,
          price_variance,
          total_variance,
          is_matched
        ) VALUES (
          v_invoice.tenant_id,
          p_invoice_id,
          v_invoice_line.id,
          v_po_line.id,
          v_po_line.quantity,
          v_invoice_line.quantity,
          v_qty_variance,
          v_po_line.unit_price,
          v_invoice_line.unit_price,
          v_price_variance,
          v_total_line_variance,
          v_is_matched
        );
      END;
    END IF;
  END LOOP;

  -- Determine matching status
  IF v_all_matched THEN
    v_matching_status := 'matched';
  ELSE
    v_matching_status := 'variance';
    
    -- Check if manager approval is required
    v_requires_approval := check_variance_requires_approval(p_invoice_id, v_total_variance);
  END IF;

  -- Update invoice
  UPDATE invoices
  SET 
    matching_status = v_matching_status,
    po_matched_at = now(),
    requires_manager_approval = v_requires_approval
  WHERE id = p_invoice_id;

  v_result := jsonb_build_object(
    'success', true,
    'matching_status', v_matching_status,
    'total_variance', v_total_variance,
    'requires_approval', v_requires_approval
  );

  RETURN v_result;
END;
$$;