-- Ensure audit_logs table has proper RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view audit logs in their tenant
DROP POLICY IF EXISTS "Users can view audit logs in their tenant" ON public.audit_logs;
CREATE POLICY "Users can view audit logs in their tenant"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());