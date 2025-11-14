
-- Update approve_reject_ap_invoice_variance function to mark associated task as completed
CREATE OR REPLACE FUNCTION approve_reject_ap_invoice_variance(
  p_invoice_id UUID,
  p_approve BOOLEAN,
  p_notes TEXT
)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
