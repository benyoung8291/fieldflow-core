-- Add customer_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_customer_id ON public.profiles(customer_id);

-- Create floor_plans table
CREATE TABLE IF NOT EXISTS public.floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.customer_locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_floor_plans_tenant_id ON public.floor_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_location_id ON public.floor_plans(location_id);

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

-- Create task_markups table
CREATE TABLE IF NOT EXISTS public.task_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  floor_plan_id UUID NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  markup_type TEXT NOT NULL CHECK (markup_type IN ('pin', 'zone')),
  data JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_markups_task_id ON public.task_markups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_markups_floor_plan_id ON public.task_markups(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_task_markups_tenant_id ON public.task_markups(tenant_id);

ALTER TABLE public.task_markups ENABLE ROW LEVEL SECURITY;

-- Security definer function to get customer_id from profile
CREATE OR REPLACE FUNCTION public.get_user_customer_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id
  FROM public.profiles
  WHERE id = _user_id;
$$;