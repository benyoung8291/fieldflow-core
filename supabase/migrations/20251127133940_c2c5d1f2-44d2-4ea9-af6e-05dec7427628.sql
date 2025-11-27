-- Allow customer portal users to view the Requests pipeline
CREATE POLICY "Customer portal users can view Requests pipeline"
ON public.helpdesk_pipelines
FOR SELECT
TO authenticated
USING (
  name = 'Requests' 
  AND EXISTS (
    SELECT 1 
    FROM customer_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    AND cpu.tenant_id = helpdesk_pipelines.tenant_id
    AND cpu.is_active = true
  )
);