-- Create security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  )
$$;

-- Create security definer function to check if user is assigned to a pipeline
CREATE OR REPLACE FUNCTION public.is_assigned_to_helpdesk_pipeline(_user_id uuid, _pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.helpdesk_pipeline_users
    WHERE user_id = _user_id
      AND pipeline_id = _pipeline_id
  )
$$;

-- Enable RLS on helpdesk_pipelines
ALTER TABLE public.helpdesk_pipelines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view assigned pipelines" ON public.helpdesk_pipelines;
DROP POLICY IF EXISTS "Users can view their assigned pipelines" ON public.helpdesk_pipelines;

-- Create policy: Users can only view pipelines they are assigned to
CREATE POLICY "Users can view assigned pipelines" 
ON public.helpdesk_pipelines
FOR SELECT
TO authenticated
USING (
  public.is_assigned_to_helpdesk_pipeline(auth.uid(), id)
  OR public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Enable RLS on helpdesk_tickets
ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing ticket policies
DROP POLICY IF EXISTS "Users can view tickets in assigned pipelines" ON public.helpdesk_tickets;

-- Create policy: Users can only view tickets in pipelines they're assigned to
CREATE POLICY "Users can view tickets in assigned pipelines"
ON public.helpdesk_tickets
FOR SELECT
TO authenticated
USING (
  public.is_assigned_to_helpdesk_pipeline(auth.uid(), pipeline_id)
  OR public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Enable RLS on helpdesk_messages
ALTER TABLE public.helpdesk_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing message policies
DROP POLICY IF EXISTS "Users can view messages in assigned pipelines" ON public.helpdesk_messages;

-- Create policy: Users can only view messages for tickets in their assigned pipelines
CREATE POLICY "Users can view messages in assigned pipelines"
ON public.helpdesk_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.helpdesk_tickets
    WHERE helpdesk_tickets.id = helpdesk_messages.ticket_id
    AND (
      public.is_assigned_to_helpdesk_pipeline(auth.uid(), helpdesk_tickets.pipeline_id)
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);