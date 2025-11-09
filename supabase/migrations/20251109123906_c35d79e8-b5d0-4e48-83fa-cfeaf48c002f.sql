-- Create time_logs table for tracking worker time on appointments
CREATE TABLE IF NOT EXISTS public.time_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  total_hours NUMERIC,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  overhead_percentage NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'approved')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view time logs in their tenant"
  ON public.time_logs
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Workers can create their own time logs"
  ON public.time_logs
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND worker_id = auth.uid());

CREATE POLICY "Workers and supervisors can update time logs"
  ON public.time_logs
  FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() AND 
    (worker_id = auth.uid() OR has_role(auth.uid(), 'supervisor'::user_role) OR has_role(auth.uid(), 'tenant_admin'::user_role))
  );

CREATE POLICY "Supervisors can delete time logs"
  ON public.time_logs
  FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND 
    (has_role(auth.uid(), 'supervisor'::user_role) OR has_role(auth.uid(), 'tenant_admin'::user_role))
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_time_logs_appointment ON public.time_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_worker ON public.time_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_tenant ON public.time_logs(tenant_id);

-- Add audit trigger
DROP TRIGGER IF EXISTS time_logs_audit_trigger ON public.time_logs;
CREATE TRIGGER time_logs_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.time_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Add updated_at trigger
DROP TRIGGER IF EXISTS time_logs_updated_at_trigger ON public.time_logs;
CREATE TRIGGER time_logs_updated_at_trigger
  BEFORE UPDATE ON public.time_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to calculate time log costs
CREATE OR REPLACE FUNCTION calculate_time_log_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Calculate total hours if clock_out is set
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600;
    
    -- Calculate total cost including overhead
    NEW.total_cost := NEW.total_hours * NEW.hourly_rate * (1 + (NEW.overhead_percentage / 100));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to auto-calculate costs
DROP TRIGGER IF EXISTS calculate_time_log_cost_trigger ON public.time_logs;
CREATE TRIGGER calculate_time_log_cost_trigger
  BEFORE INSERT OR UPDATE ON public.time_logs
  FOR EACH ROW EXECUTE FUNCTION calculate_time_log_cost();