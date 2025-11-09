-- Create task_comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  task_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view comments in their tenant"
  ON public.task_comments
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create comments in their tenant"
  ON public.task_comments
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own comments"
  ON public.task_comments
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON public.task_comments
  FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND created_by = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER handle_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for performance
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_tenant_id ON public.task_comments(tenant_id);
CREATE INDEX idx_task_comments_created_by ON public.task_comments(created_by);

-- Enable realtime
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;