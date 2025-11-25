-- Add pipeline user assignments table
CREATE TABLE IF NOT EXISTS public.helpdesk_pipeline_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.helpdesk_pipelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_id, user_id)
);

-- Add RLS policies
ALTER TABLE public.helpdesk_pipeline_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline assignments in their tenant"
  ON public.helpdesk_pipeline_users
  FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can manage pipeline assignments"
  ON public.helpdesk_pipeline_users
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'tenant_admin'
      AND tenant_id = helpdesk_pipeline_users.tenant_id
    )
  );

-- Add requires_assignment field to helpdesk_pipelines
ALTER TABLE public.helpdesk_pipelines 
ADD COLUMN IF NOT EXISTS requires_assignment BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.helpdesk_pipelines.requires_assignment IS 'Whether tickets in this pipeline must be assigned to specific users';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_helpdesk_pipeline_users_pipeline ON public.helpdesk_pipeline_users(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_pipeline_users_user ON public.helpdesk_pipeline_users(user_id);