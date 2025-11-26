-- Update RLS policy to allow supervisors to create seasonal availability for workers
DROP POLICY IF EXISTS "Workers can insert own seasonal availability" ON public.worker_seasonal_availability;

CREATE POLICY "Workers and supervisors can insert seasonal availability" 
ON public.worker_seasonal_availability 
FOR INSERT 
WITH CHECK (
  -- Worker can insert their own
  (auth.uid() = worker_id AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.tenant_id = worker_seasonal_availability.tenant_id
  ))
  OR
  -- Supervisors/admins can insert for workers in their tenant
  (tenant_id IN (
    SELECT user_roles.tenant_id
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'tenant_admin', 'supervisor', 'management')
  ))
);