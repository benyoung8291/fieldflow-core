-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('draft', 'published', 'checked_in', 'completed', 'cancelled');

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status public.appointment_status DEFAULT 'draft',
  location_address TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  gps_check_in_radius INTEGER DEFAULT 100, -- meters
  check_in_time TIMESTAMPTZ,
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_out_time TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointments
CREATE POLICY "Users can view appointments in their tenant"
  ON public.appointments FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Supervisors can create appointments in their tenant"
  ON public.appointments FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id() 
    AND (
      public.has_role(auth.uid(), 'supervisor') 
      OR public.has_role(auth.uid(), 'tenant_admin')
    )
  );

CREATE POLICY "Supervisors can update appointments in their tenant"
  ON public.appointments FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.has_role(auth.uid(), 'supervisor') 
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR assigned_to = auth.uid()
    )
  );

CREATE POLICY "Supervisors can delete appointments in their tenant"
  ON public.appointments FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.has_role(auth.uid(), 'supervisor') 
      OR public.has_role(auth.uid(), 'tenant_admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_assigned_to ON public.appointments(assigned_to);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_appointments_status ON public.appointments(status);