-- Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  enabled_modules text[] DEFAULT ARRAY[]::text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Create user_teams junction table
CREATE TABLE public.user_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Create onboarding steps table
CREATE TABLE public.team_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  step_order integer NOT NULL,
  module text NOT NULL,
  route text,
  content text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user onboarding progress table
CREATE TABLE public.user_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.team_onboarding_steps(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  skipped boolean DEFAULT false,
  UNIQUE(user_id, step_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Users can view teams in their tenant"
  ON public.teams FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role));

-- RLS Policies for user_teams
CREATE POLICY "Users can view team assignments in their tenant"
  ON public.user_teams FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage team assignments"
  ON public.user_teams FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role));

-- RLS Policies for onboarding steps
CREATE POLICY "Users can view onboarding steps in their tenant"
  ON public.team_onboarding_steps FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage onboarding steps"
  ON public.team_onboarding_steps FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role));

-- RLS Policies for user onboarding progress
CREATE POLICY "Users can view their own progress"
  ON public.user_onboarding_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role)));

CREATE POLICY "Users can update their own progress"
  ON public.user_onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage all progress"
  ON public.user_onboarding_progress FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'::user_role));

-- Create function to get user's teams
CREATE OR REPLACE FUNCTION public.get_user_teams(user_id_param uuid)
RETURNS TABLE (team_id uuid, team_name text, enabled_modules text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.enabled_modules
  FROM public.teams t
  INNER JOIN public.user_teams ut ON ut.team_id = t.id
  WHERE ut.user_id = user_id_param
    AND t.is_active = true;
$$;