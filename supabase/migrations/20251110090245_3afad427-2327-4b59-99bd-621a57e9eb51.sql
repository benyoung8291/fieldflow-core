-- First, remove the incorrectly named "Projects Team" pipeline if it has no stages
DELETE FROM public.crm_pipelines 
WHERE name = 'Projects Team';

-- Create Projects pipeline
DO $$
DECLARE
  v_tenant_id UUID;
  v_projects_pipeline_id UUID;
  v_special_projects_pipeline_id UUID;
BEGIN
  -- Get the tenant_id from existing data
  SELECT tenant_id INTO v_tenant_id FROM public.crm_pipelines LIMIT 1;
  
  -- Create Projects pipeline
  INSERT INTO public.crm_pipelines (name, description, is_default, is_active, tenant_id)
  VALUES (
    'Projects',
    'Pipeline for managing standard projects',
    false,
    true,
    v_tenant_id
  )
  RETURNING id INTO v_projects_pipeline_id;

  -- Add stages for Projects pipeline
  INSERT INTO public.crm_status_settings (tenant_id, pipeline_id, status, display_name, probability_percentage, color, display_order, is_active)
  VALUES
    (v_tenant_id, v_projects_pipeline_id, 'planning', 'Planning', 10, '#6B7280', 1, true),
    (v_tenant_id, v_projects_pipeline_id, 'in_progress', 'In Progress', 50, '#3B82F6', 2, true),
    (v_tenant_id, v_projects_pipeline_id, 'on_hold', 'On Hold', 30, '#F59E0B', 3, true),
    (v_tenant_id, v_projects_pipeline_id, 'review', 'Under Review', 75, '#8B5CF6', 4, true),
    (v_tenant_id, v_projects_pipeline_id, 'completed', 'Completed', 100, '#10B981', 5, true);

  -- Create Special Projects pipeline
  INSERT INTO public.crm_pipelines (name, description, is_default, is_active, tenant_id)
  VALUES (
    'Special Projects',
    'Pipeline for managing special or high-priority projects',
    false,
    true,
    v_tenant_id
  )
  RETURNING id INTO v_special_projects_pipeline_id;

  -- Add stages for Special Projects pipeline
  INSERT INTO public.crm_status_settings (tenant_id, pipeline_id, status, display_name, probability_percentage, color, display_order, is_active)
  VALUES
    (v_tenant_id, v_special_projects_pipeline_id, 'evaluation', 'Evaluation', 15, '#EC4899', 1, true),
    (v_tenant_id, v_special_projects_pipeline_id, 'approved', 'Approved', 40, '#8B5CF6', 2, true),
    (v_tenant_id, v_special_projects_pipeline_id, 'execution', 'In Execution', 60, '#3B82F6', 3, true),
    (v_tenant_id, v_special_projects_pipeline_id, 'final_review', 'Final Review', 85, '#F59E0B', 4, true),
    (v_tenant_id, v_special_projects_pipeline_id, 'delivered', 'Delivered', 100, '#10B981', 5, true);
END $$;