-- Add allow_bidding column to service_orders
ALTER TABLE public.service_orders
ADD COLUMN allow_bidding boolean DEFAULT false;

-- Update RLS policies for appointments to respect draft/published status
-- Drop existing policy and recreate with visibility logic
DROP POLICY IF EXISTS "Users can view appointments in their tenant" ON public.appointments;

-- Workers can only see published appointments, unless allow_bidding is enabled on the service order
CREATE POLICY "Users can view appointments based on status and role"
ON public.appointments
FOR SELECT
USING (
  tenant_id = get_user_tenant_id() AND (
    -- Supervisors and admins can see all appointments
    has_role(auth.uid(), 'supervisor'::user_role) OR 
    has_role(auth.uid(), 'tenant_admin'::user_role) OR
    -- Workers can see published appointments
    status = 'published'::appointment_status OR
    -- Workers can see draft appointments if service order allows bidding
    (status = 'draft'::appointment_status AND service_order_id IN (
      SELECT id FROM public.service_orders 
      WHERE tenant_id = get_user_tenant_id() AND allow_bidding = true
    ))
  )
);