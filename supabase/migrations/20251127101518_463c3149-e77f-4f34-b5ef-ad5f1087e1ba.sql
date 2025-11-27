-- Add 'customer' role to user_role enum if not exists
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create floor_plans table
CREATE TABLE IF NOT EXISTS public.floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.customer_locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID NOT NULL,
  CONSTRAINT fk_floor_plans_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Create task_markups table
CREATE TABLE IF NOT EXISTS public.task_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  floor_plan_id UUID NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  pin_x FLOAT NOT NULL CHECK (pin_x >= 0 AND pin_x <= 100),
  pin_y FLOAT NOT NULL CHECK (pin_y >= 0 AND pin_y <= 100),
  markup_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID NOT NULL,
  CONSTRAINT fk_task_markups_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Enable RLS on floor_plans
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

-- Floor plans policies: Customers can view their own location's floor plans
CREATE POLICY "Customers can view their floor plans"
  ON public.floor_plans
  FOR SELECT
  USING (
    location_id IN (
      SELECT cl.id 
      FROM public.customer_locations cl
      INNER JOIN public.profiles p ON p.customer_id = cl.customer_id
      WHERE p.id = auth.uid()
    )
  );

-- Staff can manage all floor plans in their tenant
CREATE POLICY "Staff can manage floor plans"
  ON public.floor_plans
  FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Enable RLS on task_markups
ALTER TABLE public.task_markups ENABLE ROW LEVEL SECURITY;

-- Task markups policies: Customers can view markups for their tasks
CREATE POLICY "Customers can view their task markups"
  ON public.task_markups
  FOR SELECT
  USING (
    task_id IN (
      SELECT t.id 
      FROM public.tasks t
      INNER JOIN public.profiles p ON p.customer_id = t.customer_id
      WHERE p.id = auth.uid()
    )
  );

-- Customers can create markups for their tasks
CREATE POLICY "Customers can create task markups"
  ON public.task_markups
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id 
      FROM public.tasks t
      INNER JOIN public.profiles p ON p.customer_id = t.customer_id
      WHERE p.id = auth.uid()
    )
  );

-- Staff can manage all task markups in their tenant
CREATE POLICY "Staff can manage task markups"
  ON public.task_markups
  FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_floor_plans_location ON public.floor_plans(location_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_tenant ON public.floor_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_markups_task ON public.task_markups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_markups_floor_plan ON public.task_markups(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_task_markups_tenant ON public.task_markups(tenant_id);