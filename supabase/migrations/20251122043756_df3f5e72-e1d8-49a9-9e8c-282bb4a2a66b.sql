-- Create worker_availability table
CREATE TABLE IF NOT EXISTS public.worker_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  is_available BOOLEAN DEFAULT true,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

-- Policies for worker_availability
CREATE POLICY "Workers can view own availability"
  ON public.worker_availability
  FOR SELECT
  TO authenticated
  USING (auth.uid() = worker_id);

CREATE POLICY "Workers can manage own availability"
  ON public.worker_availability
  FOR ALL
  TO authenticated
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

-- Index for performance
CREATE INDEX idx_worker_availability_worker_id ON public.worker_availability(worker_id);
CREATE INDEX idx_worker_availability_day ON public.worker_availability(day_of_week);