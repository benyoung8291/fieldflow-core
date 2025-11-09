-- Drop existing worker_availability table and recreate with better structure
DROP TABLE IF EXISTS public.worker_availability CASCADE;

-- Create new worker_availability table for marking when workers are NOT available
CREATE TABLE public.worker_unavailability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for worker's regular weekly schedule (which days and what hours each day)
CREATE TABLE public.worker_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, worker_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.worker_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies for worker_unavailability
CREATE POLICY "Users can view unavailability in their tenant"
  ON public.worker_unavailability FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create unavailability in their tenant"
  ON public.worker_unavailability FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update unavailability in their tenant"
  ON public.worker_unavailability FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete unavailability in their tenant"
  ON public.worker_unavailability FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for worker_schedule
CREATE POLICY "Users can view schedules in their tenant"
  ON public.worker_schedule FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create schedules in their tenant"
  ON public.worker_schedule FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update schedules in their tenant"
  ON public.worker_schedule FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete schedules in their tenant"
  ON public.worker_schedule FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add updated_at triggers
CREATE TRIGGER update_worker_unavailability_updated_at
  BEFORE UPDATE ON public.worker_unavailability
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_worker_schedule_updated_at
  BEFORE UPDATE ON public.worker_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for better performance
CREATE INDEX idx_worker_unavailability_worker ON public.worker_unavailability(worker_id, start_date, end_date);
CREATE INDEX idx_worker_schedule_worker ON public.worker_schedule(worker_id, day_of_week);