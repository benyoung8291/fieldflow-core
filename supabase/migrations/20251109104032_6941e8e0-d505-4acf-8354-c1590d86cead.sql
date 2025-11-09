-- Create task templates table
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_priority TEXT NOT NULL DEFAULT 'medium',
  default_status TEXT NOT NULL DEFAULT 'pending',
  estimated_hours NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create template checklist items table
CREATE TABLE public.task_template_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task checklist items table
CREATE TABLE public.task_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_templates
CREATE POLICY "Users can view templates in their tenant"
  ON public.task_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create templates in their tenant"
  ON public.task_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update templates in their tenant"
  ON public.task_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete templates in their tenant"
  ON public.task_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS policies for task_template_checklist_items
CREATE POLICY "Users can view template checklist items in their tenant"
  ON public.task_template_checklist_items FOR SELECT
  USING (template_id IN (
    SELECT id FROM public.task_templates WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can create template checklist items in their tenant"
  ON public.task_template_checklist_items FOR INSERT
  WITH CHECK (template_id IN (
    SELECT id FROM public.task_templates WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can update template checklist items in their tenant"
  ON public.task_template_checklist_items FOR UPDATE
  USING (template_id IN (
    SELECT id FROM public.task_templates WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can delete template checklist items in their tenant"
  ON public.task_template_checklist_items FOR DELETE
  USING (template_id IN (
    SELECT id FROM public.task_templates WHERE tenant_id = get_user_tenant_id()
  ));

-- RLS policies for task_checklist_items
CREATE POLICY "Users can view task checklist items in their tenant"
  ON public.task_checklist_items FOR SELECT
  USING (task_id IN (
    SELECT id FROM public.tasks WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can create task checklist items in their tenant"
  ON public.task_checklist_items FOR INSERT
  WITH CHECK (task_id IN (
    SELECT id FROM public.tasks WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can update task checklist items in their tenant"
  ON public.task_checklist_items FOR UPDATE
  USING (task_id IN (
    SELECT id FROM public.tasks WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can delete task checklist items in their tenant"
  ON public.task_checklist_items FOR DELETE
  USING (task_id IN (
    SELECT id FROM public.tasks WHERE tenant_id = get_user_tenant_id()
  ));

-- Create triggers
CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_task_checklist_items_updated_at
  BEFORE UPDATE ON public.task_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create indexes
CREATE INDEX idx_task_templates_tenant_id ON public.task_templates(tenant_id);
CREATE INDEX idx_task_template_checklist_items_template_id ON public.task_template_checklist_items(template_id);
CREATE INDEX idx_task_checklist_items_task_id ON public.task_checklist_items(task_id);