-- Drop the restrictive RLS policy on appointments
DROP POLICY IF EXISTS "Users can view appointments based on status and role" ON appointments;

-- Create a new simplified policy that shows all appointments in the user's tenant
CREATE POLICY "Users can view appointments in their tenant"
ON appointments
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
);