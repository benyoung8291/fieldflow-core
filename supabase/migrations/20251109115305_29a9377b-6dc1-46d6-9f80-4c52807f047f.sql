-- Create skills table for master list of skills
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Create worker_skills junction table
CREATE TABLE public.worker_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  proficiency_level TEXT DEFAULT 'beginner',
  date_acquired DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(worker_id, skill_id)
);

-- Create certificates table
CREATE TABLE public.worker_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  certificate_name TEXT NOT NULL,
  issuing_organization TEXT,
  certificate_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create licenses table
CREATE TABLE public.worker_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  license_name TEXT NOT NULL,
  license_number TEXT,
  issuing_authority TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create training records table
CREATE TABLE public.worker_training (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  training_name TEXT NOT NULL,
  training_provider TEXT,
  completion_date DATE,
  expiry_date DATE,
  hours_completed NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create service_order_skills junction table
CREATE TABLE public.service_order_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(service_order_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skills
CREATE POLICY "Users can view skills in their tenant" 
ON public.skills FOR SELECT 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create skills in their tenant" 
ON public.skills FOR INSERT 
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update skills in their tenant" 
ON public.skills FOR UPDATE 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete skills in their tenant" 
ON public.skills FOR DELETE 
USING (tenant_id = get_user_tenant_id());

-- RLS Policies for worker_skills
CREATE POLICY "Users can view worker skills in their tenant" 
ON public.worker_skills FOR SELECT 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create worker skills in their tenant" 
ON public.worker_skills FOR INSERT 
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update worker skills in their tenant" 
ON public.worker_skills FOR UPDATE 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete worker skills in their tenant" 
ON public.worker_skills FOR DELETE 
USING (tenant_id = get_user_tenant_id());

-- RLS Policies for worker_certificates
CREATE POLICY "Users can view certificates in their tenant" 
ON public.worker_certificates FOR SELECT 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create certificates in their tenant" 
ON public.worker_certificates FOR INSERT 
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update certificates in their tenant" 
ON public.worker_certificates FOR UPDATE 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete certificates in their tenant" 
ON public.worker_certificates FOR DELETE 
USING (tenant_id = get_user_tenant_id());

-- RLS Policies for worker_licenses
CREATE POLICY "Users can view licenses in their tenant" 
ON public.worker_licenses FOR SELECT 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create licenses in their tenant" 
ON public.worker_licenses FOR INSERT 
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update licenses in their tenant" 
ON public.worker_licenses FOR UPDATE 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete licenses in their tenant" 
ON public.worker_licenses FOR DELETE 
USING (tenant_id = get_user_tenant_id());

-- RLS Policies for worker_training
CREATE POLICY "Users can view training in their tenant" 
ON public.worker_training FOR SELECT 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create training in their tenant" 
ON public.worker_training FOR INSERT 
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update training in their tenant" 
ON public.worker_training FOR UPDATE 
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete training in their tenant" 
ON public.worker_training FOR DELETE 
USING (tenant_id = get_user_tenant_id());

-- RLS Policies for service_order_skills
CREATE POLICY "Users can view service order skills in their tenant" 
ON public.service_order_skills FOR SELECT 
USING (service_order_id IN (
  SELECT id FROM public.service_orders WHERE tenant_id = get_user_tenant_id()
));

CREATE POLICY "Users can create service order skills in their tenant" 
ON public.service_order_skills FOR INSERT 
WITH CHECK (service_order_id IN (
  SELECT id FROM public.service_orders WHERE tenant_id = get_user_tenant_id()
));

CREATE POLICY "Users can delete service order skills in their tenant" 
ON public.service_order_skills FOR DELETE 
USING (service_order_id IN (
  SELECT id FROM public.service_orders WHERE tenant_id = get_user_tenant_id()
));

-- Create indexes
CREATE INDEX idx_worker_skills_worker ON public.worker_skills(worker_id);
CREATE INDEX idx_worker_skills_skill ON public.worker_skills(skill_id);
CREATE INDEX idx_worker_certificates_worker ON public.worker_certificates(worker_id);
CREATE INDEX idx_worker_licenses_worker ON public.worker_licenses(worker_id);
CREATE INDEX idx_worker_training_worker ON public.worker_training(worker_id);
CREATE INDEX idx_service_order_skills_order ON public.service_order_skills(service_order_id);

-- Create updated_at triggers
CREATE TRIGGER update_skills_updated_at
BEFORE UPDATE ON public.skills
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_skills_updated_at
BEFORE UPDATE ON public.worker_skills
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_certificates_updated_at
BEFORE UPDATE ON public.worker_certificates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_licenses_updated_at
BEFORE UPDATE ON public.worker_licenses
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_training_updated_at
BEFORE UPDATE ON public.worker_training
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();