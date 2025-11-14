
-- Update request_ap_invoice_approval function to create a task for manager approval
CREATE OR REPLACE FUNCTION request_ap_invoice_approval(
  p_invoice_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
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
    now() + interval '2 days' -- Due in 2 days
  ) RETURNING id INTO v_task_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Approval requested successfully',
    'task_id', v_task_id,
    'variance_percentage', v_variance_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
