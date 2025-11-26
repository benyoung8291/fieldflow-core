-- Create table for seasonal availability overrides
CREATE TABLE IF NOT EXISTS public.worker_seasonal_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monday_available BOOLEAN DEFAULT false,
  monday_periods TEXT[] DEFAULT '{}',
  tuesday_available BOOLEAN DEFAULT false,
  tuesday_periods TEXT[] DEFAULT '{}',
  wednesday_available BOOLEAN DEFAULT false,
  wednesday_periods TEXT[] DEFAULT '{}',
  thursday_available BOOLEAN DEFAULT false,
  thursday_periods TEXT[] DEFAULT '{}',
  friday_available BOOLEAN DEFAULT false,
  friday_periods TEXT[] DEFAULT '{}',
  saturday_available BOOLEAN DEFAULT false,
  saturday_periods TEXT[] DEFAULT '{}',
  sunday_available BOOLEAN DEFAULT false,
  sunday_periods TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.worker_seasonal_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Workers can view their own seasonal availability
CREATE POLICY "Workers can view own seasonal availability"
  ON public.worker_seasonal_availability
  FOR SELECT
  USING (
    auth.uid() = worker_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND tenant_id = worker_seasonal_availability.tenant_id
    )
  );

-- Policy: Workers can insert their own seasonal availability
CREATE POLICY "Workers can insert own seasonal availability"
  ON public.worker_seasonal_availability
  FOR INSERT
  WITH CHECK (
    auth.uid() = worker_id
    AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND tenant_id = worker_seasonal_availability.tenant_id
    )
  );

-- Policy: Workers can update their own seasonal availability
CREATE POLICY "Workers can update own seasonal availability"
  ON public.worker_seasonal_availability
  FOR UPDATE
  USING (
    auth.uid() = worker_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid()
      AND p.tenant_id = worker_seasonal_availability.tenant_id
      AND ur.role IN ('tenant_admin', 'management', 'supervisor')
    )
  );

-- Policy: Workers can delete their own seasonal availability
CREATE POLICY "Workers can delete own seasonal availability"
  ON public.worker_seasonal_availability
  FOR DELETE
  USING (
    auth.uid() = worker_id
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid()
      AND p.tenant_id = worker_seasonal_availability.tenant_id
      AND ur.role IN ('tenant_admin', 'management', 'supervisor')
    )
  );

-- Create index for efficient lookups
CREATE INDEX idx_worker_seasonal_availability_worker_dates 
  ON public.worker_seasonal_availability(worker_id, start_date, end_date);

CREATE INDEX idx_worker_seasonal_availability_tenant 
  ON public.worker_seasonal_availability(tenant_id);

-- Create function to check if a date falls within a seasonal override period
CREATE OR REPLACE FUNCTION public.get_seasonal_availability_for_date(
  p_worker_id UUID,
  p_date DATE
) RETURNS TABLE (
  season_name TEXT,
  day_periods TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wsa.season_name,
    CASE EXTRACT(DOW FROM p_date)
      WHEN 0 THEN wsa.sunday_periods
      WHEN 1 THEN wsa.monday_periods
      WHEN 2 THEN wsa.tuesday_periods
      WHEN 3 THEN wsa.wednesday_periods
      WHEN 4 THEN wsa.thursday_periods
      WHEN 5 THEN wsa.friday_periods
      WHEN 6 THEN wsa.saturday_periods
    END as day_periods
  FROM public.worker_seasonal_availability wsa
  WHERE wsa.worker_id = p_worker_id
    AND p_date BETWEEN wsa.start_date AND wsa.end_date
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;