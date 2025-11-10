-- Create default "Sales Team" pipeline for existing stages
INSERT INTO public.crm_pipelines (name, description, is_default, is_active, tenant_id)
SELECT 
  'Sales Team',
  'Default sales pipeline',
  true,
  true,
  tenant_id
FROM public.crm_status_settings
WHERE pipeline_id IS NULL
GROUP BY tenant_id
ON CONFLICT DO NOTHING;

-- Update all existing stages without a pipeline to point to Sales Team
UPDATE public.crm_status_settings
SET pipeline_id = (
  SELECT id FROM public.crm_pipelines 
  WHERE name = 'Sales Team' 
  AND tenant_id = crm_status_settings.tenant_id
  LIMIT 1
)
WHERE pipeline_id IS NULL;