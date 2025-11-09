-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  actual_cost NUMERIC DEFAULT 0,
  progress INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view projects in their tenant"
  ON public.projects FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create projects in their tenant"
  ON public.projects FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update projects in their tenant"
  ON public.projects FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete projects in their tenant"
  ON public.projects FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add audit trigger
CREATE TRIGGER log_projects_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();