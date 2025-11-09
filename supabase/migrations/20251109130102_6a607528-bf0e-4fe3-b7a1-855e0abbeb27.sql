-- Create junction table for appointment workers (many-to-many)
CREATE TABLE public.appointment_workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(appointment_id, worker_id)
);

-- Enable RLS
ALTER TABLE public.appointment_workers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view appointment workers in their tenant"
  ON public.appointment_workers FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Supervisors can manage appointment workers"
  ON public.appointment_workers FOR ALL
  USING (
    tenant_id = get_user_tenant_id() AND 
    (has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'tenant_admin'))
  );

-- Add index for performance
CREATE INDEX idx_appointment_workers_appointment ON public.appointment_workers(appointment_id);
CREATE INDEX idx_appointment_workers_worker ON public.appointment_workers(worker_id);

-- Migrate existing single assignments to the new table
INSERT INTO public.appointment_workers (tenant_id, appointment_id, worker_id)
SELECT tenant_id, id, assigned_to
FROM public.appointments
WHERE assigned_to IS NOT NULL;