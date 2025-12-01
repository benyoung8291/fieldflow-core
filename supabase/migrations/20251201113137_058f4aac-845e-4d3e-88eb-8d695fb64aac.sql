-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can view tickets in assigned pipelines" ON helpdesk_tickets;

-- Create updated policy that properly handles NULL pipeline_id
CREATE POLICY "Users can view tickets in assigned pipelines" ON helpdesk_tickets
FOR SELECT USING (
  -- Staff with admin roles can see all tickets in their tenant
  (tenant_id = get_user_tenant_id() AND (
    has_role(auth.uid(), 'tenant_admin'::user_role) OR 
    has_role(auth.uid(), 'super_admin'::user_role)
  ))
  OR
  -- Users assigned to specific pipelines can see those tickets
  (pipeline_id IS NOT NULL AND is_assigned_to_helpdesk_pipeline(auth.uid(), pipeline_id))
  OR
  -- Staff can see unassigned tickets (no pipeline) in their tenant
  (pipeline_id IS NULL AND tenant_id = get_user_tenant_id())
);