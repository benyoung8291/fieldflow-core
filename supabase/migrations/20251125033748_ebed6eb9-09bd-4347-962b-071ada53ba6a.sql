-- Create table for tracking module tutorial progress
CREATE TABLE IF NOT EXISTS public.user_module_tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_name)
);

-- Enable RLS
ALTER TABLE public.user_module_tutorials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tutorial progress"
  ON public.user_module_tutorials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutorial progress"
  ON public.user_module_tutorials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutorial progress"
  ON public.user_module_tutorials
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_user_module_tutorials_user_id ON public.user_module_tutorials(user_id);
CREATE INDEX idx_user_module_tutorials_module_name ON public.user_module_tutorials(module_name);

-- Create table for storing module tutorial content
CREATE TABLE IF NOT EXISTS public.module_tutorial_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, module_name)
);

-- Enable RLS
ALTER TABLE public.module_tutorial_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tutorial content
CREATE POLICY "Users can view tutorial content for their tenant"
  ON public.module_tutorial_content
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can manage tutorial content"
  ON public.module_tutorial_content
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant_admin'
    )
  );

-- Create indexes
CREATE INDEX idx_module_tutorial_content_tenant_id ON public.module_tutorial_content(tenant_id);
CREATE INDEX idx_module_tutorial_content_module_name ON public.module_tutorial_content(module_name);