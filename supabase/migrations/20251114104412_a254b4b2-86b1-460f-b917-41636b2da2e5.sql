-- Fix SECURITY DEFINER functions by adding fixed search_path
-- This prevents privilege escalation attacks through search path manipulation

-- Fix approve_reject_ap_invoice_variance
CREATE OR REPLACE FUNCTION public.approve_reject_ap_invoice_variance(p_invoice_id uuid, p_approve boolean, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_new_status TEXT;
BEGIN
  -- Determine new status
  IF p_approve THEN
    v_new_status := 'approved';
  ELSE
    v_new_status := 'rejected';
  END IF;

  -- Update invoice approval status
  UPDATE invoices
  SET 
    approval_status = v_new_status,
    manager_approval_notes = COALESCE(manager_approval_notes || E'\n\n', '') || 
      'Decision by ' || COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'Unknown') || 
      ' on ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || E':\n' || p_notes,
    updated_at = now()
  WHERE id = p_invoice_id;

  -- Mark associated task(s) as completed
  UPDATE tasks
  SET 
    status = 'completed',
    completed_at = now(),
    description = description || E'\n\n**Decision:** ' || 
      CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END || E'\n' ||
      '**Decision Notes:** ' || p_notes
  WHERE linked_module = 'invoice' 
    AND linked_record_id = p_invoice_id 
    AND status != 'completed';

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_approve THEN 'Invoice approved successfully'
      ELSE 'Invoice rejected'
    END,
    'new_status', v_new_status
  );
END;
$function$;

-- Fix check_variance_requires_approval
CREATE OR REPLACE FUNCTION public.check_variance_requires_approval(p_invoice_id uuid, p_total_variance numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix perform_three_way_match
CREATE OR REPLACE FUNCTION public.perform_three_way_match(p_invoice_id uuid, p_tolerance_percentage numeric DEFAULT 5.0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix request_ap_invoice_approval
CREATE OR REPLACE FUNCTION public.request_ap_invoice_approval(p_invoice_id uuid, p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id UUID;
  v_invoice_number TEXT;
  v_total_amount NUMERIC;
  v_supplier_name TEXT;
  v_total_variance NUMERIC;
  v_variance_percentage NUMERIC;
  v_owner_id UUID;
  v_task_id UUID;
  v_task_title TEXT;
  v_task_description TEXT;
BEGIN
  -- Get invoice details and owner
  SELECT 
    i.tenant_id,
    i.invoice_number,
    i.total_amount,
    s.name,
    i.created_by,
    COALESCE(SUM(m.total_variance), 0),
    CASE 
      WHEN i.total_amount > 0 THEN ABS(COALESCE(SUM(m.total_variance), 0) / i.total_amount * 100)
      ELSE 0
    END
  INTO 
    v_tenant_id,
    v_invoice_number,
    v_total_amount,
    v_supplier_name,
    v_owner_id,
    v_total_variance,
    v_variance_percentage
  FROM invoices i
  LEFT JOIN suppliers s ON i.supplier_id = s.id
  LEFT JOIN ap_invoice_line_matching m ON i.id = m.invoice_id
  WHERE i.id = p_invoice_id
  GROUP BY i.id, i.tenant_id, i.invoice_number, i.total_amount, s.name, i.created_by;

  -- Update invoice to request approval
  UPDATE invoices
  SET 
    requires_manager_approval = true,
    approval_status = 'pending',
    approval_requested_at = now(),
    approval_requested_by = auth.uid(),
    manager_approval_notes = p_notes
  WHERE id = p_invoice_id;

  -- Create task title and description
  v_task_title := 'AP Invoice Approval Required: ' || v_invoice_number;
  v_task_description := E'**Invoice Details:**\n\n' ||
    '- **Invoice Number:** ' || v_invoice_number || E'\n' ||
    '- **Supplier:** ' || COALESCE(v_supplier_name, 'N/A') || E'\n' ||
    '- **Total Amount:** $' || v_total_amount::TEXT || E'\n' ||
    '- **Variance:** $' || ABS(v_total_variance)::TEXT || ' (' || v_variance_percentage::TEXT || E'%)\n\n' ||
    '**Action Required:** Review and approve/reject this AP invoice with variance above threshold.' || E'\n\n' ||
    '**Review Link:** [Open Approval Queue](/ap-invoice-approval-queue)' || E'\n' ||
    '**Invoice Link:** [View Invoice](/invoices/' || p_invoice_id::TEXT || ')';

  IF p_notes IS NOT NULL THEN
    v_task_description := v_task_description || E'\n\n**Notes:** ' || p_notes;
  END IF;

  -- Create a task for the invoice owner (manager)
  INSERT INTO tasks (
    tenant_id,
    title,
    description,
    status,
    priority,
    assigned_to,
    created_by,
    linked_module,
    linked_record_id,
    due_date
  ) VALUES (
    v_tenant_id,
    v_task_title,
    v_task_description,
    'pending',
    'high',
    v_owner_id,
    auth.uid(),
    'invoice',
    p_invoice_id,
    now() + interval '2 days'
  ) RETURNING id INTO v_task_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Approval requested successfully',
    'task_id', v_task_id,
    'variance_percentage', v_variance_percentage
  );
END;
$function$;