-- Create pay rate categories table
CREATE TABLE public.pay_rate_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hourly_rate NUMERIC(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.pay_rate_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pay_rate_categories
CREATE POLICY "Users can view pay rate categories in their tenant"
  ON public.pay_rate_categories FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage pay rate categories"
  ON public.pay_rate_categories FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role));

-- Add worker-specific fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_file_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS abn TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS super_fund_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS super_fund_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_rate_category_id UUID REFERENCES public.pay_rate_categories(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_days TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_start_time TIME;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_end_time TIME;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create worker availability table
CREATE TABLE public.worker_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worker_id, date, start_time)
);

-- Enable RLS
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for worker_availability
CREATE POLICY "Users can view availability in their tenant"
  ON public.worker_availability FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins and workers can manage availability"
  ON public.worker_availability FOR ALL
  USING (
    tenant_id = get_user_tenant_id() AND 
    (has_role(auth.uid(), 'tenant_admin'::user_role) OR 
     has_role(auth.uid(), 'supervisor'::user_role) OR 
     worker_id = auth.uid())
  );

-- Add triggers for updated_at
CREATE TRIGGER update_pay_rate_categories_updated_at
  BEFORE UPDATE ON public.pay_rate_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_availability_updated_at
  BEFORE UPDATE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add audit logging triggers
CREATE TRIGGER pay_rate_categories_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pay_rate_categories
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER worker_availability_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER profiles_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();