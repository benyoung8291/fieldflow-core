-- Add RLS policy to allow users to view profiles of workers in appointments they can see
CREATE POLICY "Users can view profiles of assigned workers"
ON profiles
FOR SELECT
USING (
  id IN (
    SELECT DISTINCT aw.worker_id 
    FROM appointment_workers aw
    INNER JOIN appointments a ON a.id = aw.appointment_id
    WHERE a.tenant_id = get_user_tenant_id()
  )
);