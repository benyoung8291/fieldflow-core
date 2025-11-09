-- Create appointment templates table
CREATE TABLE public.appointment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_hours NUMERIC(4,2) NOT NULL DEFAULT 2,
  default_status TEXT DEFAULT 'draft',
  default_assigned_to UUID REFERENCES public.profiles(id),
  location_address TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  gps_check_in_radius INTEGER DEFAULT 100,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  recurrence_frequency INTEGER DEFAULT 1,
  recurrence_days_of_week TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Create service order templates table
CREATE TABLE public.service_order_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  title TEXT NOT NULL,
  billing_type TEXT,
  hourly_rate NUMERIC(10,2),
  fixed_amount NUMERIC(10,2),
  estimated_hours NUMERIC(10,2),
  priority TEXT,
  default_assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.appointment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointment_templates
CREATE POLICY "Users can view templates in their tenant"
  ON public.appointment_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create templates in their tenant"
  ON public.appointment_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update templates in their tenant"
  ON public.appointment_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete templates in their tenant"
  ON public.appointment_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for service_order_templates
CREATE POLICY "Users can view SO templates in their tenant"
  ON public.service_order_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create SO templates in their tenant"
  ON public.service_order_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update SO templates in their tenant"
  ON public.service_order_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete SO templates in their tenant"
  ON public.service_order_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add triggers for updated_at
CREATE TRIGGER update_appointment_templates_updated_at
  BEFORE UPDATE ON public.appointment_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_service_order_templates_updated_at
  BEFORE UPDATE ON public.service_order_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add audit logging triggers
CREATE TRIGGER appointment_templates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.appointment_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER service_order_templates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.service_order_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();