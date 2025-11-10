-- Create project_tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started',
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view project tasks in their tenant"
  ON public.project_tasks FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create project tasks in their tenant"
  ON public.project_tasks FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update project tasks in their tenant"
  ON public.project_tasks FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete project tasks in their tenant"
  ON public.project_tasks FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create project_task_line_items junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_task_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  line_item_id UUID NOT NULL REFERENCES public.project_line_items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(task_id, line_item_id)
);

-- Enable RLS
ALTER TABLE public.project_task_line_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view task line items in their tenant"
  ON public.project_task_line_items FOR SELECT
  USING (task_id IN (SELECT id FROM public.project_tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can create task line items in their tenant"
  ON public.project_task_line_items FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM public.project_tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can delete task line items in their tenant"
  ON public.project_task_line_items FOR DELETE
  USING (task_id IN (SELECT id FROM public.project_tasks WHERE tenant_id = get_user_tenant_id()));

-- Create project_task_dependencies table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'finish_to_start',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Enable RLS
ALTER TABLE public.project_task_dependencies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view task dependencies in their tenant"
  ON public.project_task_dependencies FOR SELECT
  USING (task_id IN (SELECT id FROM public.project_tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can create task dependencies in their tenant"
  ON public.project_task_dependencies FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM public.project_tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can delete task dependencies in their tenant"
  ON public.project_task_dependencies FOR DELETE
  USING (task_id IN (SELECT id FROM public.project_tasks WHERE tenant_id = get_user_tenant_id()));