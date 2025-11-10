-- Create pipelines table
CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pipelines
CREATE POLICY "Users can view pipelines in their tenant"
  ON public.crm_pipelines
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create pipelines in their tenant"
  ON public.crm_pipelines
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update pipelines in their tenant"
  ON public.crm_pipelines
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete pipelines in their tenant"
  ON public.crm_pipelines
  FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add pipeline_id to crm_status_settings
ALTER TABLE public.crm_status_settings
ADD COLUMN pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE;

-- Drop the old unique constraint and create a new one that includes pipeline_id
ALTER TABLE public.crm_status_settings
DROP CONSTRAINT IF EXISTS crm_status_settings_tenant_id_status_key;

ALTER TABLE public.crm_status_settings
ADD CONSTRAINT crm_status_settings_tenant_pipeline_status_key 
UNIQUE(tenant_id, pipeline_id, status);

-- Add pipeline and stage to quotes
ALTER TABLE public.quotes
ADD COLUMN pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
ADD COLUMN stage_id UUID REFERENCES public.crm_status_settings(id) ON DELETE SET NULL;

-- Add default pipeline/stage to profiles
ALTER TABLE public.profiles
ADD COLUMN default_pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
ADD COLUMN default_stage_id UUID REFERENCES public.crm_status_settings(id) ON DELETE SET NULL;

-- Create trigger for updated_at on pipelines
CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for pipeline lookups
CREATE INDEX idx_crm_status_settings_pipeline ON public.crm_status_settings(pipeline_id);
CREATE INDEX idx_quotes_pipeline ON public.quotes(pipeline_id);
CREATE INDEX idx_quotes_stage ON public.quotes(stage_id);

COMMENT ON TABLE public.crm_pipelines IS 'CRM sales pipelines that contain multiple stages for tracking quote/lead progression';
COMMENT ON COLUMN public.quotes.pipeline_id IS 'The CRM pipeline this quote belongs to';
COMMENT ON COLUMN public.quotes.stage_id IS 'The current stage/status within the pipeline';